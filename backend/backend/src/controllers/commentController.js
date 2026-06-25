import Comment from '../models/Comment.js';
import Song from '../models/Song.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import { getIO } from '../config/socket.js';
import { parsePagination } from '../utils/apiResponse.js';

// Comment length limits — old code accepted comments of unbounded size,
// letting one user post a megabyte of text per comment. 2000 chars matches
// most platforms (Twitter is 280, YouTube is 10000; we land in between).
const MAX_COMMENT_LENGTH = 2000;
const MIN_COMMENT_LENGTH = 1;

// HTML entity escape for user-supplied content. We're not running an HTML
// editor here — comments are plain text — so the safest thing is to escape
// special chars at write time. Frontend can then render them as plain text
// without dangerouslySetInnerHTML.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Best-effort Socket.IO notification dispatch.
 *
 * The original code did `const io = getIO(); io.to(...).emit(...)` and
 * left it unhandled. If Socket.IO isn't initialized (e.g., during tests),
 * `getIO()` throws and the whole request 500s.
 */
function emitToUser(userId, event, data) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
  } catch (err) {
    // Socket.IO not ready — log and continue.
    console.error(`Socket emit failed (${event}):`, err.message);
  }
}

// ============================================================
// POST /api/comments                     (auth required)
// ============================================================
export const addComment = async (req, res) => {
  try {
    const { songId, content, parentCommentId } = req.body;

    if (!songId) return res.status(400).json({ error: 'songId is required' });
    if (typeof content !== 'string' || content.trim().length < MIN_COMMENT_LENGTH) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({
        error: `Comment too long (max ${MAX_COMMENT_LENGTH} characters)`,
      });
    }

    const song = await Song.findById(songId).populate('artist');
    if (!song) return res.status(404).json({ error: 'Song not found' });

    // FIX: Escape HTML at write-time so the frontend can render content
    // as plain text without re-escaping. The original code stored raw
    // user input, meaning any frontend that used innerHTML/dangerouslySetInnerHTML
    // would execute injected scripts.
    const safeContent = escapeHtml(content.trim());

    // If replying, verify the parent exists and belongs to the same song.
    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
      if (parentComment.song.toString() !== songId) {
        // SECURITY: Old code didn't verify that parentComment was on the
        // same song. A user could post a "reply" linking a comment on
        // song A to song B, breaking the threading model and potentially
        // confusing moderation.
        return res.status(400).json({ error: 'Parent comment is on a different song' });
      }
    }

    const comment = await Comment.create({
      user: req.user._id,
      song: songId,
      content: safeContent,
      parentComment: parentCommentId || null,
    });

    // FIX: Atomic increment — old `song.commentCount++; save()` was racy.
    await Song.findByIdAndUpdate(songId, { $inc: { commentCount: 1 } });

    // If this is a reply, link it on the parent and notify the parent's author.
    if (parentComment) {
      // FIX: $addToSet — old `replies.push; save()` was racy.
      await Comment.findByIdAndUpdate(parentComment._id, {
        $addToSet: { replies: comment._id },
      });

      if (parentComment.user.toString() !== req.user._id.toString()) {
        const notification = await Notification.create({
          user: parentComment.user,
          type: 'comment',
          title: 'New Reply',
          message: `${req.user.username} replied to your comment on "${song.title}"`,
          data: { songId, commentId: comment._id },
        });
        emitToUser(parentComment.user, 'notification', notification);
      }
    } else if (song.artist && song.artist.userId.toString() !== req.user._id.toString()) {
      // Top-level comment — notify the artist.
      const notification = await Notification.create({
        user: song.artist.userId,
        type: 'comment',
        title: 'New Comment',
        message: `${req.user.username} commented on your song "${song.title}"`,
        data: { songId, commentId: comment._id },
      });
      emitToUser(song.artist.userId, 'notification', notification);
    }

    await comment.populate('user', 'username avatar');
    res.status(201).json({ message: 'Comment added', comment });
  } catch (err) {
    console.error('addComment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

// ============================================================
// GET /api/comments/song/:songId         (public, uses optionalAuth)
// ============================================================
export const getSongComments = async (req, res) => {
  try {
    const { songId } = req.params;
    const { page, limit, skip } = parsePagination(req.query);

    const filter = { song: songId, parentComment: null, isDeleted: false };

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate('user', 'username avatar')
        .populate({
          path: 'replies',
          match: { isDeleted: false },
          populate: { path: 'user', select: 'username avatar' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments(filter),
    ]);

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getSongComments error:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

// ============================================================
// POST /api/comments/:commentId/like     (auth required)
// ============================================================
//
// FIX: Old `indexOf` + `splice`/`push` + `save` is racy. Use atomic
// $pull / $addToSet on the likes array.
//
export const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const userId = req.user._id;
    const alreadyLiked = comment.likes.some((id) => id.toString() === userId.toString());

    if (alreadyLiked) {
      await Comment.findByIdAndUpdate(comment._id, { $pull: { likes: userId } });
      return res.json({ message: 'Comment unliked', liked: false });
    }

    await Comment.findByIdAndUpdate(comment._id, { $addToSet: { likes: userId } });

    // Notify the comment's author (unless they liked their own).
    if (comment.user.toString() !== userId.toString()) {
      const notification = await Notification.create({
        user: comment.user,
        type: 'like',
        title: 'Comment Liked',
        message: `${req.user.username} liked your comment`,
        data: { commentId: comment._id },
      });
      emitToUser(comment.user, 'notification', notification);
    }

    res.json({ message: 'Comment liked', liked: true });
  } catch (err) {
    console.error('likeComment error:', err);
    res.status(500).json({ error: 'Failed to like comment' });
  }
};

// ============================================================
// DELETE /api/comments/:commentId        (auth required)
// ============================================================
//
// Soft delete (isDeleted: true) — preserves the reply tree.
//
// FIX: commentCount decrement is now atomic + floor-at-zero.
// FIX: Don't decrement if the comment is already deleted (idempotent).
//
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (comment.isDeleted) {
      // Already deleted — idempotent success.
      return res.json({ message: 'Comment deleted' });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    // Atomic decrement with floor-at-zero.
    await Song.findByIdAndUpdate(comment.song, { $inc: { commentCount: -1 } });
    await Song.updateOne(
      { _id: comment.song, commentCount: { $lt: 0 } },
      { $set: { commentCount: 0 } }
    );

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('deleteComment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

// ============================================================
// POST /api/comments/:commentId/report   (auth required)
// ============================================================
//
// FIX: Old code let the same user report the same comment 1000 times
// in a loop. Now we dedupe per (reporter, comment) using $setOnInsert.
//
export const reportComment = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.length < 3 || reason.length > 500) {
      return res.status(400).json({ error: 'reason must be 3-500 characters' });
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Don't let a user report their own comment.
    if (comment.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot report your own comment' });
    }

    // Dedupe: if this user has already reported this comment, return
    // the existing report. The Report model should ideally have a unique
    // compound index on { reporter, contentId, type } but we belt-and-
    // -suspenders here too.
    const existingReport = await Report.findOne({
      reporter: req.user._id,
      type: 'comment',
      contentId: comment._id,
    });
    if (existingReport) {
      return res.json({ message: 'Comment already reported' });
    }

    // Mark the comment as flagged. We don't increment a counter here
    // because $inc on a hot comment from many reporters could mask
    // single-reporter spam. Moderators count Reports, not the flag bit.
    await Comment.findByIdAndUpdate(comment._id, {
      $set: { isFlagged: true, flaggedAt: new Date(), flaggedReason: reason },
    });

    await Report.create({
      reporter: req.user._id,
      type: 'comment',
      contentId: comment._id,
      reason: escapeHtml(reason),
      status: 'pending',
    });

    res.json({ message: 'Comment reported' });
  } catch (err) {
    console.error('reportComment error:', err);
    res.status(500).json({ error: 'Failed to report comment' });
  }
};
