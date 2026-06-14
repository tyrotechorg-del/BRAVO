import Playlist from '../models/Playlist.js';
import Song from '../models/Song.js';
import Notification from '../models/Notification.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// POST /api/playlists                    (auth required)
// ============================================================
export const createPlaylist = async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const playlist = await Playlist.create({
      name: name.trim(),
      description: description || '',
      user: req.user._id,
      isPublic: isPublic !== false, // default true
      songs: [],
    });

    res.status(201).json({
      message: 'Playlist created successfully',
      playlist,
    });
  } catch (err) {
    console.error('createPlaylist error:', err);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
};

// ============================================================
// GET /api/playlists                     (auth required — own playlists)
// ============================================================
export const getUserPlaylists = async (req, res) => {
  try {
    // Old code returned ALL playlists with no pagination — fine for
    // a few dozen, breaks at scale. Added pagination.
    const { page, limit, skip } = parsePagination(req.query);

    const [playlists, total] = await Promise.all([
      Playlist.find({ user: req.user._id })
        .populate('songs', 'title coverArt duration artist')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Playlist.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      playlists,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getUserPlaylists error:', err);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
};

// ============================================================
// GET /api/playlists/:id                 (public, uses optionalAuth)
// ============================================================
//
// FIX: Old code did `playlist.user.toString() !== req.user._id.toString()`
// to check ownership for private playlists. If `req.user` was undefined
// (guest), accessing `req.user._id` threw `Cannot read property '_id'
// of undefined`. Now guests are handled explicitly.
//
export const getPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('songs', 'title coverArt duration artist playCount')
      .populate('user', 'username avatar');

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Private playlists are only visible to their owner.
    if (!playlist.isPublic) {
      const isOwner =
        req.user && playlist.user._id.toString() === req.user._id.toString();
      if (!isOwner) {
        // Return 404 (not 403) — don't confirm the playlist exists to
        // outsiders. Same pattern as paymentController.getPaymentStatus.
        return res.status(404).json({ error: 'Playlist not found' });
      }
    }

    // RACE FIX: Atomic increment. Old code did `playCount++; save()`.
    // We don't wait for it to complete — fire and forget.
    Playlist.findByIdAndUpdate(playlist._id, { $inc: { playCount: 1 } }).catch((err) =>
      console.error('Playlist playCount update failed:', err.message)
    );

    res.json(playlist);
  } catch (err) {
    console.error('getPlaylist error:', err);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
};

// ============================================================
// PUT /api/playlists/:id                 (auth required)
// ============================================================
export const updatePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { name, description, isPublic } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
      playlist.name = name.trim();
    }
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = Boolean(isPublic);

    playlist.updatedAt = Date.now();
    await playlist.save();

    res.json({ message: 'Playlist updated', playlist });
  } catch (err) {
    console.error('updatePlaylist error:', err);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
};

// ============================================================
// DELETE /api/playlists/:id              (auth required)
// ============================================================
export const deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await playlist.deleteOne();
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    console.error('deletePlaylist error:', err);
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
};

// ============================================================
// POST /api/playlists/:id/songs          (auth required)
// ============================================================
export const addSongToPlaylist = async (req, res) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId is required' });

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    // FIX: $addToSet — atomic and idempotent. Old code's
    // .includes -> .push -> .save had a race condition.
    const updated = await Playlist.findByIdAndUpdate(
      playlist._id,
      { $addToSet: { songs: songId } },
      { new: true }
    );

    res.json({ message: 'Song added to playlist', playlist: updated });
  } catch (err) {
    console.error('addSongToPlaylist error:', err);
    res.status(500).json({ error: 'Failed to add song' });
  }
};

// ============================================================
// DELETE /api/playlists/:id/songs        (auth required)
// ============================================================
export const removeSongFromPlaylist = async (req, res) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId is required' });

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // FIX: $pull is atomic.
    const updated = await Playlist.findByIdAndUpdate(
      playlist._id,
      { $pull: { songs: songId } },
      { new: true }
    );

    res.json({ message: 'Song removed from playlist', playlist: updated });
  } catch (err) {
    console.error('removeSongFromPlaylist error:', err);
    res.status(500).json({ error: 'Failed to remove song' });
  }
};

// ============================================================
// POST /api/playlists/:id/like           (auth required)
// ============================================================
//
// FIX: Old code did $indexOf + push/splice + save — racy. Use atomic
// $addToSet / $pull. We need to know whether the like was added or
// removed for the response, so we check the result.
//
export const likePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    const userId = req.user._id;
    const alreadyLiked = playlist.likes.some((id) => id.toString() === userId.toString());

    if (alreadyLiked) {
      await Playlist.findByIdAndUpdate(playlist._id, { $pull: { likes: userId } });
      return res.json({ message: 'Playlist unliked', liked: false });
    }

    await Playlist.findByIdAndUpdate(playlist._id, { $addToSet: { likes: userId } });

    // Notify the playlist owner (but not yourself).
    if (playlist.user.toString() !== userId.toString()) {
      Notification.create({
        user: playlist.user,
        type: 'like',
        title: 'Playlist Liked',
        message: `${req.user.username} liked your playlist "${playlist.name}"`,
        data: { playlistId: playlist._id },
      }).catch((err) => console.error('Notification create failed:', err.message));
    }

    res.json({ message: 'Playlist liked', liked: true });
  } catch (err) {
    console.error('likePlaylist error:', err);
    res.status(500).json({ error: 'Failed to like playlist' });
  }
};

// ============================================================
// GET /api/playlists/featured            (public)
// ============================================================
export const getFeaturedPlaylists = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const playlists = await Playlist.find({ isFeatured: true, isPublic: true })
      .populate('user', 'username avatar')
      .populate('songs', 'title coverArt')
      .limit(limit);

    res.json(playlists);
  } catch (err) {
    console.error('getFeaturedPlaylists error:', err);
    res.status(500).json({ error: 'Failed to fetch featured playlists' });
  }
};
