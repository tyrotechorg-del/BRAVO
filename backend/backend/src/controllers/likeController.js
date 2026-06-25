import Like from '../models/Like.js';
import Song from '../models/Song.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import { getIO } from '../config/socket.js';
import { parsePagination } from '../utils/apiResponse.js';

// Whitelist of valid like target types. The original code used
// `[type === 'song' ? 'song' : 'comment']: targetId` which is fine for
// {song, comment} but extends to any string — if someone passes
// `type: '__proto__'`, the computed property becomes `__proto__`,
// which can interact badly with Mongoose / prototype pollution. Now
// strictly validated.
const VALID_TYPES = new Set(['song', 'comment']);

const TARGET_FIELD = { song: 'song', comment: 'comment' };

function emitToUser(userId, event, data) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
  } catch (err) {
    console.error(`Socket emit failed (${event}):`, err.message);
  }
}

// ============================================================
// POST /api/likes/toggle                 (auth required)
// ============================================================
//
// FIX: The original toggle had a race condition between findOne and
// create — two simultaneous toggle-from-not-liked requests could both
// pass the "doesn't exist" check and both insert Like documents,
// double-counting likeCount.
//
// The fix uses the existing unique index on {user, song, type} (and
// {user, comment, type}). `Like.create` throws E11000 on duplicate,
// which we catch as "already liked — toggle off instead".
//
// FIX: `type` strictly whitelisted (was open string).
//
export const toggleLike = async (req, res) => {
  try {
    const { type, targetId } = req.body;

    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ error: 'type must be "song" or "comment"' });
    }
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' });
    }

    const field = TARGET_FIELD[type];
    const filter = { user: req.user._id, type, [field]: targetId };

    // Atomic delete: if the like exists, this returns the deleted doc.
    const deleted = await Like.findOneAndDelete(filter);

    if (deleted) {
      // Was liked — toggle off.
      if (type === 'song') {
        await Song.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } });
        await Song.updateOne(
          { _id: targetId, likeCount: { $lt: 0 } },
          { $set: { likeCount: 0 } }
        );
      } else {
        await Comment.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } });
        await Comment.updateOne(
          { _id: targetId, likeCount: { $lt: 0 } },
          { $set: { likeCount: 0 } }
        );
      }
      return res.json({ liked: false, message: 'Like removed' });
    }

    // Was not liked — toggle on. Create with try/catch to handle E11000
    // (extremely unlikely after the findOneAndDelete returned nothing,
    // but possible if two requests race here).
    try {
      await Like.create({ user: req.user._id, type, [field]: targetId });
    } catch (err) {
      if (err.code === 11000) {
        // Race: someone else liked between our delete and create.
        // Just return success — the user wanted "liked" and they're liked.
        return res.json({ liked: true, message: 'Already liked' });
      }
      throw err;
    }

    if (type === 'song') {
      await Song.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });

      const song = await Song.findById(targetId).populate('artist');
      if (song?.artist && song.artist.userId.toString() !== req.user._id.toString()) {
        const notification = await Notification.create({
          user: song.artist.userId,
          type: 'like',
          title: 'New Like',
          message: `${req.user.username} liked your song "${song.title}"`,
          data: { songId: targetId, type: 'song' },
        });
        emitToUser(song.artist.userId, 'notification', notification);
      }
    } else {
      await Comment.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });

      const comment = await Comment.findById(targetId);
      if (comment && comment.user.toString() !== req.user._id.toString()) {
        const notification = await Notification.create({
          user: comment.user,
          type: 'like',
          title: 'New Like',
          message: `${req.user.username} liked your comment`,
          data: { commentId: targetId, type: 'comment' },
        });
        emitToUser(comment.user, 'notification', notification);
      }
    }

    res.json({ liked: true, message: 'Like added' });
  } catch (err) {
    console.error('toggleLike error:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
};

// ============================================================
// GET /api/likes                         (auth required)
// ============================================================
export const getUserLikes = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { type } = req.query;

    const query = { user: req.user._id };
    if (type && VALID_TYPES.has(type)) {
      query.type = type;
    }

    const [likes, total] = await Promise.all([
      Like.find(query)
        .populate('song', 'title coverArt artist duration playCount')
        .populate('comment', 'content user createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Like.countDocuments(query),
    ]);

    res.json({
      likes,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getUserLikes error:', err);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
};

// ============================================================
// GET /api/likes/check/:type/:targetId   (auth required)
// ============================================================
export const checkLikeStatus = async (req, res) => {
  try {
    const { type, targetId } = req.params;

    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ error: 'type must be "song" or "comment"' });
    }

    const field = TARGET_FIELD[type];
    const like = await Like.findOne({
      user: req.user._id,
      type,
      [field]: targetId,
    });

    res.json({ liked: Boolean(like) });
  } catch (err) {
    console.error('checkLikeStatus error:', err);
    res.status(500).json({ error: 'Failed to check like status' });
  }
};
