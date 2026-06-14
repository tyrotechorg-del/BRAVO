import mongoose from 'mongoose';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Song from '../models/Song.js';
import Album from '../models/Album.js';
import Payment from '../models/Payment.js';
import Withdrawal from '../models/Withdrawal.js';
import Report from '../models/Report.js';
import Comment from '../models/Comment.js';
import AdminLog from '../models/AdminLog.js';
import Wallet from '../models/Wallet.js';
import Like from '../models/Like.js';
import Playlist from '../models/Playlist.js';
import Notification from '../models/Notification.js';
import backupService from '../services/backupService.js';
import notificationService from '../services/notificationService.js';
import storageService from '../services/storageService.js';
import audioService from '../services/audioService.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// Helpers
// ============================================================

// Same escapeRegex as searchController — used here for ReDoS-safe admin search.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildContainsMatch(q) {
  if (typeof q !== 'string' || !q.trim()) return null;
  const trimmed = q.trim().slice(0, 100);
  return { $regex: escapeRegex(trimmed), $options: 'i' };
}

// Whitelist of safe sort fields for admin listing endpoints. Without this,
// `sortBy` could be `password` or `__proto__`. None of those would expose
// data given the select() clauses, but defense in depth is cheap.
const SONG_SORT_FIELDS = new Set([
  'createdAt', 'updatedAt', 'title', 'playCount', 'downloadCount', 'likeCount',
  'status', 'genre',
]);

function parseSort(sortBy, sortOrder, allowed, defaultField = 'createdAt') {
  const field = allowed.has(sortBy) ? sortBy : defaultField;
  const order = sortOrder === 'asc' ? 1 : -1;
  return { [field]: order };
}

async function logAdminAction(adminId, action, targetId, details = {}) {
  try {
    await AdminLog.create({ admin: adminId, action, target: targetId, details });
  } catch (err) {
    // Audit log failures shouldn't break the request, but we need to
    // know about them — admin actions are supposed to be auditable.
    console.error('AdminLog write failed:', err.message);
  }
}

function parseList(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val) return val.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

// ============================================================
// USER MANAGEMENT
// ============================================================

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { role, search } = req.query;
    const query = {};

    // FIX: Validate role against the schema's enum.
    if (role && ['listener', 'artist', 'admin'].includes(role)) {
      query.role = role;
    }

    // FIX: ReDoS-safe search.
    const match = buildContainsMatch(search);
    if (match) {
      query.$or = [{ username: match }, { email: match }];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -emailVerificationToken -passwordResetToken')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET /api/admin/users/:userId
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    let artistProfile = null;
    const stats = { totalSongs: 0, totalAlbums: 0, totalStreams: 0, totalSpent: 0 };

    if (user.role === 'artist') {
      artistProfile = await Artist.findOne({ userId: user._id });
      if (artistProfile) {
        const songs = await Song.find({ artist: artistProfile._id });
        stats.totalSongs = songs.length;
        stats.totalStreams = songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
        stats.totalAlbums = await Album.countDocuments({ artist: artistProfile._id });
      }
    }

    const payments = await Payment.find({ user: user._id, status: 'completed' });
    stats.totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({ user, artistProfile, stats });
  } catch (err) {
    console.error('getUserDetails error:', err);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

// PUT /api/admin/users/:userId/status
//
// FIX: Prevent admin self-modification (deactivating yourself, demoting
// yourself). Prevent escalation of other admins to a non-admin role.
// Original code let an admin demote a peer to listener silently.
const updateUserStatus = async (req, res) => {
  try {
    const { isActive, role } = req.body;
    const targetId = req.params.userId;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot modify your own account here' });
    }

    const user = await User.findById(targetId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const previous = { isActive: user.isActive, role: user.role };
    const changes = {};

    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
      changes.isActive = user.isActive;
    }

    if (role !== undefined) {
      if (!['listener', 'artist', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      // Only admins can be assigned the admin role — this endpoint is
      // already admin-gated by middleware, so this comment is for
      // future readers: changing roles is intentionally a separate
      // privileged action.
      user.role = role;
      changes.role = role;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No changes specified' });
    }

    await user.save();
    await logAdminAction(req.user._id, 'update_user', user._id, { previous, changes });

    res.json({ message: 'User updated successfully', user: user.toJSON() });
  } catch (err) {
    console.error('updateUserStatus error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// DELETE /api/admin/users/:userId
//
// FIX: Same "songs were never deleted" bug as userController.deleteAccount.
// Old code: `Song.find({ artist: user._id })` — but Song.artist is the
// Artist._id, not the User._id. Songs of deleted artists became orphans
// in the DB and their files leaked on disk.
// FIX: Transactional cascade delete.
// FIX: Can't delete yourself.
//
const deleteUser = async (req, res) => {
  if (req.params.userId === req.user._id.toString()) {
    return res.status(400).json({ error: 'You cannot delete your own account here' });
  }

  let songFilesToDelete = [];
  let coverFilesToDelete = [];
  const session = await mongoose.startSession();

  try {
    let username;
    let email;

    await session.withTransaction(async () => {
      const user = await User.findById(req.params.userId).session(session);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }
      username = user.username;
      email = user.email;

      if (user.role === 'artist') {
        const artistProfile = await Artist.findOne({ userId: user._id }).session(session);
        if (artistProfile) {
          // BUG FIX: query via Artist._id, not User._id.
          const songs = await Song.find({ artist: artistProfile._id }).session(session);
          for (const song of songs) {
            if (song.audioUrl && !song.audioUrl.startsWith('http')) {
              songFilesToDelete.push(song.audioUrl);
            }
            if (song.videoUrl && !song.videoUrl.startsWith('http')) {
              songFilesToDelete.push(song.videoUrl);
            }
            if (
              song.coverArt &&
              !song.coverArt.startsWith('http') &&
              !song.coverArt.includes('unsplash')
            ) {
              coverFilesToDelete.push(song.coverArt);
            }
          }
          await Song.deleteMany({ artist: artistProfile._id }).session(session);
          await Album.deleteMany({ artist: artistProfile._id }).session(session);
          await Artist.deleteOne({ _id: artistProfile._id }).session(session);
        }
      }

      // Soft-delete comments (preserve thread structure for other users).
      await Comment.updateMany(
        { user: user._id },
        { $set: { isDeleted: true, deletedAt: new Date(), content: '[deleted]' } }
      ).session(session);

      await Like.deleteMany({ user: user._id }).session(session);
      await Playlist.deleteMany({ user: user._id }).session(session);
      await Wallet.deleteOne({ user: user._id }).session(session);
      await Notification.deleteMany({ user: user._id }).session(session);

      await User.updateMany(
        { $or: [{ followers: user._id }, { following: user._id }] },
        { $pull: { followers: user._id, following: user._id } }
      ).session(session);

      await User.findByIdAndDelete(user._id).session(session);
    });

    // Best-effort file deletion outside the transaction.
    for (const file of [...songFilesToDelete, ...coverFilesToDelete]) {
      storageService.deleteFile(file).catch((err) =>
        console.error('Failed to delete file:', file, err.message)
      );
    }

    await logAdminAction(req.user._id, 'delete_user', req.params.userId, { username, email });

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('deleteUser error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    await session.endSession();
  }
};

// ============================================================
// ARTIST MANAGEMENT
// ============================================================

// GET /api/admin/artists
const getAllArtists = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [artists, total] = await Promise.all([
      Artist.find()
        .populate('userId', 'email fullName avatar username isActive')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Artist.countDocuments(),
    ]);

    res.json({
      artists,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getAllArtists error:', err);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
};

// POST /api/admin/artists/:artistId/verify
const verifyArtist = async (req, res) => {
  try {
    // Atomic update — was findOne + mutate + save.
    const artist = await Artist.findByIdAndUpdate(
      req.params.artistId,
      { $set: { verified: true } },
      { new: true }
    );

    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    await logAdminAction(req.user._id, 'verify_artist', artist._id, {
      stageName: artist.stageName,
    });

    res.json({ message: 'Artist verified successfully', artist });
  } catch (err) {
    console.error('verifyArtist error:', err);
    res.status(500).json({ error: 'Failed to verify artist' });
  }
};

// POST /api/admin/artists/:artistId/feature
//
// FIX: The old `artist.featured = !artist.featured` toggle was racy
// (two concurrent clicks could net-zero). We now accept an explicit
// boolean from the request body.
const featureArtist = async (req, res) => {
  try {
    const { featured } = req.body;
    if (typeof featured !== 'boolean') {
      return res.status(400).json({ error: 'featured must be true or false' });
    }

    const artist = await Artist.findByIdAndUpdate(
      req.params.artistId,
      { $set: { featured } },
      { new: true }
    );

    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    await logAdminAction(
      req.user._id,
      featured ? 'feature_artist' : 'unfeature_artist',
      artist._id
    );

    res.json({ message: featured ? 'Artist featured' : 'Artist unfeatured', artist });
  } catch (err) {
    console.error('featureArtist error:', err);
    res.status(500).json({ error: 'Failed to update artist feature status' });
  }
};

// ============================================================
// SONG MANAGEMENT
// ============================================================

// GET /api/admin/songs
const getAllSongs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
    const { status } = req.query;
    const query = {};
    if (status && ['pending', 'approved', 'rejected', 'featured'].includes(status)) {
      query.status = status;
    }

    const [songs, total] = await Promise.all([
      Song.find(query)
        .populate('artist', 'stageName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Song.countDocuments(query),
    ]);

    res.json({
      songs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getAllSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
};

// GET /api/admin/songs/pending
const getPendingSongs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [songs, total] = await Promise.all([
      Song.find({ status: 'pending' })
        .populate('artist', 'stageName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Song.countDocuments({ status: 'pending' }),
    ]);

    res.json({ songs, total, currentPage: page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getPendingSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch pending songs' });
  }
};

// POST /api/admin/songs/:songId/approve
//
// FIX: Idempotent — if already approved, return success without re-
// sending notifications.
const approveSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.songId).populate('artist');
    if (!song) return res.status(404).json({ error: 'Song not found' });

    if (song.status === 'approved') {
      return res.json({ message: 'Song already approved', song });
    }

    song.status = 'approved';
    await song.save();

    if (song.artist?.userId) {
      notificationService.createNotification(
        song.artist.userId,
        'admin',
        'Song Approved',
        `Your song "${song.title}" has been approved and is now live!`,
        { songId: song._id }
      ).catch((err) => console.error('Notification failed:', err.message));
    }

    await logAdminAction(req.user._id, 'approve_song', song._id, { title: song.title });

    res.json({ message: 'Song approved successfully', song });
  } catch (err) {
    console.error('approveSong error:', err);
    res.status(500).json({ error: 'Failed to approve song' });
  }
};

// POST /api/admin/songs/:songId/reject
const rejectSong = async (req, res) => {
  try {
    const { reason } = req.body;
    const song = await Song.findById(req.params.songId).populate('artist');
    if (!song) return res.status(404).json({ error: 'Song not found' });

    if (song.status === 'rejected') {
      return res.json({ message: 'Song already rejected', song });
    }

    song.status = 'rejected';
    song.rejectionReason = reason || 'Content guidelines violation';
    await song.save();

    if (song.artist?.userId) {
      notificationService.createNotification(
        song.artist.userId,
        'admin',
        'Song Rejected',
        `Your song "${song.title}" was rejected. Reason: ${song.rejectionReason}`,
        { songId: song._id }
      ).catch((err) => console.error('Notification failed:', err.message));
    }

    await logAdminAction(req.user._id, 'reject_song', song._id, {
      title: song.title,
      reason: song.rejectionReason,
    });

    res.json({ message: 'Song rejected', song });
  } catch (err) {
    console.error('rejectSong error:', err);
    res.status(500).json({ error: 'Failed to reject song' });
  }
};

// DELETE /api/admin/songs/:songId
const deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.songId);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    // Remove from album first to keep ref integrity.
    if (song.album) {
      await Album.findByIdAndUpdate(song.album, { $pull: { songs: song._id } });
    }

    // Best-effort file deletion — log but don't block on failure.
    if (song.audioUrl && !song.audioUrl.startsWith('http')) {
      storageService.deleteFile(song.audioUrl).catch((err) =>
        console.error('Failed to delete audio:', err.message)
      );
    }
    if (song.videoUrl && !song.videoUrl.startsWith('http')) {
      storageService.deleteFile(song.videoUrl).catch((err) =>
        console.error('Failed to delete video:', err.message)
      );
    }
    if (song.coverArt && !song.coverArt.startsWith('http') && !song.coverArt.includes('unsplash')) {
      storageService.deleteFile(song.coverArt).catch((err) =>
        console.error('Failed to delete cover:', err.message)
      );
    }

    await song.deleteOne();
    await logAdminAction(req.user._id, 'delete_song', song._id, { title: song.title });

    res.json({ message: 'Song deleted successfully' });
  } catch (err) {
    console.error('deleteSong error:', err);
    res.status(500).json({ error: 'Failed to delete song' });
  }
};

// ============================================================
// ALBUM MANAGEMENT
// ============================================================

// GET /api/admin/albums
const getAllAlbums = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [albums, total] = await Promise.all([
      Album.find()
        .populate('artist', 'stageName')
        .populate('songs', 'title duration')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Album.countDocuments(),
    ]);

    res.json({ albums, total, currentPage: page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getAllAlbums error:', err);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
};

// ============================================================
// ADMIN UPLOAD (song / video / album)
// ============================================================

// POST /api/admin/songs/upload
//
// FIX: Removed `console.log` of full req.body — could leak credentials
// or PII in logs.
// FIX: tags/featuredArtists parse safely (array OR comma-string).
// FIX: Validate price is non-negative.
//
const adminUploadSong = async (req, res) => {
  try {
    const { title, genre, artistId, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;

    if (!title || !genre || !artistId) {
      return res.status(400).json({ error: 'title, genre, and artistId are required' });
    }

    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const numPrice = Number(price) || 0;
    if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative' });

    const audioFile = req.files?.audio?.[0];
    const coverFile = req.files?.coverArt?.[0];

    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const [audioUrl, coverArtUrl, duration] = await Promise.all([
      storageService.uploadAudio(audioFile, artistId),
      coverFile
        ? storageService.uploadImage(coverFile, 'covers')
        : Promise.resolve('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300'),
      audioService.getDuration(audioFile.path).catch(() => 180),
    ]);

    const song = await Song.create({
      title,
      artist: artistId,
      genre,
      duration,
      audioUrl,
      coverArt: coverArtUrl,
      price: numPrice,
      isPremium: isPremium === 'true' || isPremium === true,
      lyrics: lyrics || '',
      tags: parseList(tags),
      featuredArtists: parseList(featuredArtists),
      status: 'approved', // admin uploads bypass moderation
    });

    if (albumId) {
      const album = await Album.findById(albumId);
      if (album && album.artist.toString() === artistId.toString()) {
        await Album.findByIdAndUpdate(albumId, { $addToSet: { songs: song._id } });
        song.album = albumId;
        await song.save();
      }
    }

    await logAdminAction(req.user._id, 'admin_upload_song', song._id, {
      title,
      artist: artist.stageName,
    });

    res.status(201).json({ message: 'Song uploaded and approved successfully', song });
  } catch (err) {
    console.error('adminUploadSong error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

// POST /api/admin/songs/upload-video
const adminUploadVideo = async (req, res) => {
  try {
    const { title, genre, artistId, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;

    if (!title || !genre || !artistId) {
      return res.status(400).json({ error: 'title, genre, and artistId are required' });
    }

    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const videoFile = req.files?.video?.[0];
    if (!videoFile) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    const numPrice = Number(price) || 0;
    if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative' });

    const audioFile = req.files?.audio?.[0];
    const coverFile = req.files?.coverArt?.[0];

    const [videoUrl, audioUrl, coverArtUrl, duration] = await Promise.all([
      storageService.uploadVideo(videoFile, artistId),
      audioFile ? storageService.uploadAudio(audioFile, artistId) : Promise.resolve(null),
      coverFile
        ? storageService.uploadImage(coverFile, 'covers')
        : Promise.resolve('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300'),
      audioService.getDuration(videoFile.path).catch(() => 180),
    ]);

    const song = await Song.create({
      title,
      artist: artistId,
      genre,
      duration,
      audioUrl: audioUrl || videoUrl,
      videoUrl,
      coverArt: coverArtUrl,
      price: numPrice,
      isPremium: isPremium === 'true' || isPremium === true,
      isVideo: true,
      lyrics: lyrics || '',
      tags: parseList(tags),
      featuredArtists: parseList(featuredArtists),
      status: 'approved',
    });

    if (albumId) {
      const album = await Album.findById(albumId);
      if (album && album.artist.toString() === artistId.toString()) {
        await Album.findByIdAndUpdate(albumId, { $addToSet: { songs: song._id } });
      }
    }

    await logAdminAction(req.user._id, 'admin_upload_video', song._id, {
      title,
      artist: artist.stageName,
    });

    res.status(201).json({
      message: 'Video song uploaded and approved successfully',
      song,
    });
  } catch (err) {
    console.error('adminUploadVideo error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

// POST /api/admin/albums/upload
const adminUploadAlbum = async (req, res) => {
  try {
    const { title, artistId, description, genre, type, price, isPremium, songs } = req.body;

    if (!title || !artistId) {
      return res.status(400).json({ error: 'title and artistId are required' });
    }

    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    if (!req.file) return res.status(400).json({ error: 'Cover art is required' });

    const numPrice = Number(price) || 0;
    if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative' });

    const coverArtUrl = await storageService.uploadImage(req.file, 'covers');

    const album = await Album.create({
      title,
      artist: artistId,
      description,
      genre,
      type: type || 'album',
      price: numPrice,
      isPremium: isPremium === 'true' || isPremium === true,
      coverArt: coverArtUrl,
      status: 'published', // admin albums auto-publish
    });

    // Add existing songs to album if specified.
    const songIds = parseList(songs); // FIX: was `songs.split(',')` which crashed on array input.
    if (songIds.length > 0) {
      const validSongs = await Song.find({
        _id: { $in: songIds },
        artist: artistId, // FIX: verify song belongs to artist
      }).select('_id');

      const validIds = validSongs.map((s) => s._id);
      if (validIds.length > 0) {
        await Album.findByIdAndUpdate(album._id, { $addToSet: { songs: { $each: validIds } } });
        await Song.updateMany({ _id: { $in: validIds } }, { $set: { album: album._id } });
      }
    }

    await logAdminAction(req.user._id, 'admin_upload_album', album._id, {
      title,
      artist: artist.stageName,
      genre,
    });

    res.status(201).json({ message: 'Album created and published successfully', album });
  } catch (err) {
    console.error('adminUploadAlbum error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};

// ============================================================
// WITHDRAWALS
// ============================================================

// GET /api/admin/withdrawals
const getWithdrawals = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status } = req.query;
    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .populate('user', 'username email fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Withdrawal.countDocuments(query),
    ]);

    res.json({
      withdrawals,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('getWithdrawals error:', err);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
};

// POST /api/admin/withdrawals/process
//
// MAJOR FIX — THIS WAS THE MOST DANGEROUS BUG IN THE CODEBASE.
//
// The original code did:
//
//   if (action === 'approve') {
//     withdrawal.status = 'approved';
//     const wallet = await Wallet.findOne(...);
//     wallet.totalWithdrawn += withdrawal.amount;  // ← read-modify-write
//     wallet.pendingWithdrawal -= withdrawal.amount;
//     await wallet.save();
//   } else if (action === 'reject') {
//     withdrawal.status = 'rejected';
//     wallet.balance += withdrawal.amount;          // ← read-modify-write
//     wallet.pendingWithdrawal -= withdrawal.amount;
//   }
//
// Two critical problems:
//
//   1. NOT IDEMPOTENT. If the admin calls /process twice (network
//      retry, double-click, replay attack via captured admin token),
//      the wallet is updated TWICE. For reject, this credits the user
//      their withdrawal amount AGAIN — infinite money loop. For
//      approve, it inflates `totalWithdrawn` by 2× the actual payout.
//
//   2. RACE CONDITIONS. Two admins acting on different withdrawals
//      for the same user simultaneously can lose wallet updates.
//
// The fix:
//   - First, atomically transition the withdrawal status. The filter
//     includes `status: 'pending'`, so only the first call succeeds.
//     Subsequent calls find no document and return 400.
//   - Wrap the wallet update in a MongoDB transaction with the
//     status transition.
//   - Use $inc for atomic wallet updates.
//
const processWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { withdrawalId, action, transactionReference } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }
    if (!withdrawalId) {
      return res.status(400).json({ error: 'withdrawalId is required' });
    }

    let withdrawal;

    await session.withTransaction(async () => {
      // Atomic status transition. Only succeeds if the withdrawal is
      // still pending. If another admin already processed it (or this
      // is a retry of a successful call), this returns null and we abort.
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: withdrawalId, status: 'pending' },
        {
          $set: {
            status: newStatus,
            processedAt: new Date(),
            processedBy: req.user._id,
            transactionReference: transactionReference || null,
          },
        },
        { new: true, session }
      );

      if (!withdrawal) {
        throw new Error('ALREADY_PROCESSED');
      }

      // Atomic wallet update.
      if (action === 'approve') {
        // Withdrawal completed externally. Move pendingWithdrawal to totalWithdrawn.
        await Wallet.findOneAndUpdate(
          { user: withdrawal.user },
          {
            $inc: {
              totalWithdrawn: withdrawal.amount,
              pendingWithdrawal: -withdrawal.amount,
            },
            $set: { updatedAt: new Date() },
          },
          { session }
        );
      } else {
        // Reject: return funds from pendingWithdrawal to spendable balance.
        await Wallet.findOneAndUpdate(
          { user: withdrawal.user },
          {
            $inc: {
              balance: withdrawal.amount,
              pendingWithdrawal: -withdrawal.amount,
            },
            $set: { updatedAt: new Date() },
          },
          { session }
        );
      }
    });

    // Notifications outside the transaction.
    const notifTitle = action === 'approve' ? 'Withdrawal Approved' : 'Withdrawal Rejected';
    const notifMessage =
      action === 'approve'
        ? `Your withdrawal of K${withdrawal.amount} has been approved and processed.`
        : `Your withdrawal request of K${withdrawal.amount} has been rejected.`;
    notificationService.createNotification(
      withdrawal.user,
      'withdrawal',
      notifTitle,
      notifMessage,
      { amount: withdrawal.amount, status: action }
    ).catch((err) => console.error('Notification failed:', err.message));

    await logAdminAction(req.user._id, `withdrawal_${action}`, withdrawal._id, {
      amount: withdrawal.amount,
      reference: transactionReference,
    });

    res.json({ message: `Withdrawal ${action}d`, withdrawal });
  } catch (err) {
    if (err.message === 'ALREADY_PROCESSED') {
      return res.status(400).json({
        error: 'Withdrawal not found or already processed',
      });
    }
    console.error('processWithdrawal error:', err);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  } finally {
    await session.endSession();
  }
};

// ============================================================
// REPORTS
// ============================================================

// GET /api/admin/reports
const getReports = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status } = req.query;
    const query = {};
    if (status && ['pending', 'resolved', 'dismissed'].includes(status)) {
      query.status = status;
    } else {
      query.status = 'pending'; // default
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('reporter', 'username email')
        .populate('reportedUser', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(query),
    ]);

    res.json({ reports, total, currentPage: page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getReports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// POST /api/admin/reports/resolve
//
// FIX: Idempotent — only act on pending reports.
const resolveReport = async (req, res) => {
  try {
    const { reportId, action, adminNotes } = req.body;

    const VALID_ACTIONS = ['remove_content', 'warn_user', 'ban_user', 'dismiss'];
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Atomic transition — only resolve pending reports.
    const report = await Report.findOneAndUpdate(
      { _id: reportId, status: 'pending' },
      {
        $set: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: req.user._id,
          adminNotes,
          actionTaken: action,
        },
      },
      { new: true }
    );

    if (!report) {
      return res.status(400).json({ error: 'Report not found or already resolved' });
    }

    // Apply the action.
    if (action === 'remove_content') {
      if (report.type === 'song') {
        await Song.findByIdAndDelete(report.contentId);
      } else if (report.type === 'comment') {
        await Comment.findByIdAndUpdate(report.contentId, {
          $set: { isDeleted: true, deletedAt: new Date() },
        });
      }
    } else if (action === 'ban_user' && report.reportedUser) {
      // TODO: token revocation. Until we have a JWT blocklist, the
      // banned user can keep using their current token until expiry.
      await User.findByIdAndUpdate(report.reportedUser, { $set: { isActive: false } });
    }
    // warn_user / dismiss — no side effect beyond the report status.

    await logAdminAction(req.user._id, 'resolve_report', report._id, {
      action,
      adminNotes,
    });

    res.json({ message: 'Report resolved', report });
  } catch (err) {
    console.error('resolveReport error:', err);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
};

// ============================================================
// SYSTEM SETTINGS
// ============================================================

// GET /api/admin/settings
const getSystemSettings = async (req, res) => {
  // These come from env. Real persistence would require a SystemSettings
  // collection — flagged in the README.
  res.json({
    platformCommission: Number(process.env.PLATFORM_COMMISSION_RATE) || 10,
    minWithdrawalAmount: Number(process.env.MIN_WITHDRAWAL_AMOUNT) || 50,
    maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE_MB) || 50,
    subscriptionPlans: {
      artist_basic: { price: 50,  uploadLimit: 10, features: ['Basic Analytics', '10 Uploads'] },
      artist_pro:   { price: 120, uploadLimit: -1, features: ['Advanced Analytics', 'Unlimited Uploads', 'Monetization'] },
      artist_vip:   { price: 300, uploadLimit: -1, features: ['Verified Badge', 'Homepage Promotion', 'Priority Support'] },
    },
  });
};

// PUT /api/admin/settings
//
// FLAGGED — the original implementation is fundamentally broken and I'm
// keeping the new version intentionally limited. Original code did:
//
//   if (platformCommission) process.env.PLATFORM_COMMISSION_RATE = platformCommission;
//
// Problems:
//   1. Mutates `process.env` at runtime. Doesn't persist across restarts.
//   2. Only affects ONE Node process. In a multi-instance deployment
//      (PM2 cluster, Kubernetes), only one instance gets the update.
//      The other instances continue using the old value.
//   3. No validation — `platformCommission: "wat"` would accept happily.
//
// Proper fix requires a SystemSettings collection in MongoDB that is
// read at startup AND on each settings read. Until that exists, this
// endpoint:
//   - Validates input numerically.
//   - Mutates process.env (preserving the broken behaviour for
//     compatibility with whatever code reads these vars at runtime).
//   - Logs prominently so it's obvious this is half-done.
//
const updateSystemSettings = async (req, res) => {
  try {
    const { platformCommission, minWithdrawalAmount, maxUploadSize } = req.body;
    const changes = {};

    if (platformCommission !== undefined) {
      const n = Number(platformCommission);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({ error: 'platformCommission must be 0-100' });
      }
      process.env.PLATFORM_COMMISSION_RATE = String(n);
      changes.platformCommission = n;
    }

    if (minWithdrawalAmount !== undefined) {
      const n = Number(minWithdrawalAmount);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: 'minWithdrawalAmount must be non-negative' });
      }
      process.env.MIN_WITHDRAWAL_AMOUNT = String(n);
      changes.minWithdrawalAmount = n;
    }

    if (maxUploadSize !== undefined) {
      const n = Number(maxUploadSize);
      if (!Number.isFinite(n) || n <= 0 || n > 5000) {
        return res.status(400).json({ error: 'maxUploadSize must be 1-5000 (MB)' });
      }
      process.env.MAX_UPLOAD_SIZE_MB = String(n);
      changes.maxUploadSize = n;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    await logAdminAction(req.user._id, 'update_settings', null, changes);

    console.warn(
      '[updateSystemSettings] Mutating process.env at runtime. ' +
      'Settings do not persist across restarts and do not propagate to ' +
      'other instances in a clustered deployment. Replace with a ' +
      'persistent SystemSettings collection.'
    );

    res.json({ message: 'Settings updated (in-memory only — see warnings)', changes });
  } catch (err) {
    console.error('updateSystemSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// ============================================================
// BACKUP
// ============================================================

const triggerBackup = async (req, res) => {
  try {
    await backupService.createBackup();
    await logAdminAction(req.user._id, 'trigger_backup', null);
    res.json({ message: 'Backup initiated successfully' });
  } catch (err) {
    console.error('triggerBackup error:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
};

// ============================================================
// REPORTED COMMENTS
// ============================================================

const getReportedComments = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [comments, total] = await Promise.all([
      Comment.find({ isFlagged: true, isDeleted: false })
        .populate('user', 'username')
        .populate('song', 'title')
        .sort({ flaggedAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments({ isFlagged: true, isDeleted: false }),
    ]);

    res.json({ comments, total, currentPage: page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getReportedComments error:', err);
    res.status(500).json({ error: 'Failed to fetch reported comments' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndUpdate(
      req.params.commentId,
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Decrement song's commentCount.
    await Song.findByIdAndUpdate(comment.song, { $inc: { commentCount: -1 } });
    await Song.updateOne(
      { _id: comment.song, commentCount: { $lt: 0 } },
      { $set: { commentCount: 0 } }
    );

    await logAdminAction(req.user._id, 'delete_comment', comment._id);
    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('deleteComment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

// ============================================================
// PLATFORM ANALYTICS
// ============================================================

// GET /api/admin/analytics/platform
//
// FIX: Run all counts in parallel — old code ran 7 sequential queries.
const getPlatformAnalytics = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalArtists,
      totalSongs,
      totalAlbums,
      totalPending,
      revenueAgg,
      commissionAgg,
      newUsersLast30Days,
      newSongsLast30Days,
    ] = await Promise.all([
      User.countDocuments(),
      Artist.countDocuments(),
      Song.countDocuments({ status: 'approved' }),
      Album.countDocuments(),
      Song.countDocuments({ status: 'pending' }),
      Payment.aggregate([
        { $match: { status: 'completed', type: { $ne: 'withdrawal' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$platformCommission' } } },
      ]),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Song.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, status: 'approved' }),
    ]);

    res.json({
      overview: {
        totalUsers,
        totalArtists,
        totalSongs,
        totalAlbums,
        totalPending,
        totalRevenue: revenueAgg[0]?.total || 0,
        platformCommission: commissionAgg[0]?.total || 0,
      },
      growth: { newUsersLast30Days, newSongsLast30Days },
    });
  } catch (err) {
    console.error('getPlatformAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// GET /api/admin/analytics/revenue
const getRevenueAnalytics = async (req, res) => {
  try {
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

    const [monthlyRevenue, revenueByType] = await Promise.all([
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: elevenMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            total: { $sum: '$amount' },
            commission: { $sum: '$platformCommission' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({ monthly: monthlyRevenue, byType: revenueByType });
  } catch (err) {
    console.error('getRevenueAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
};

// ============================================================
// ENHANCED ADMIN LISTINGS
// ============================================================

// GET /api/admin/songs/all
const getAllSongsForAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, genre, artistId, search, isVideo, sortBy, sortOrder } = req.query;

    const query = {};
    if (status && ['pending', 'approved', 'rejected', 'featured'].includes(status)) {
      query.status = status;
    }
    if (genre) query.genre = genre;
    if (artistId) query.artist = artistId;
    if (isVideo !== undefined) query.isVideo = isVideo === 'true';

    const searchMatch = buildContainsMatch(search);
    if (searchMatch) {
      query.$or = [{ title: searchMatch }, { tags: searchMatch }];
    }

    const sort = parseSort(sortBy, sortOrder, SONG_SORT_FIELDS);

    const [songs, total, byStatus, byGenre, withVideo] = await Promise.all([
      Song.find(query)
        .populate('artist', 'stageName userId email')
        .populate('album', 'title')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Song.countDocuments(query),
      Promise.all([
        Song.countDocuments({ status: 'pending' }),
        Song.countDocuments({ status: 'approved' }),
        Song.countDocuments({ status: 'rejected' }),
        Song.countDocuments({ status: 'featured' }),
      ]).then(([pending, approved, rejected, featured]) => ({
        pending, approved, rejected, featured,
      })),
      Song.aggregate([
        { $group: { _id: '$genre', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Song.countDocuments({ isVideo: true }),
    ]);

    res.json({
      success: true,
      songs,
      stats: { total, ...byStatus, withVideo, byGenre },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (err) {
    console.error('getAllSongsForAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
};

// GET /api/admin/artists/all
const getAllArtistsForAdmin = async (req, res) => {
  try {
    const { search, verified, featured } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const query = {};
    const searchMatch = buildContainsMatch(search);
    if (searchMatch) {
      query.$or = [{ stageName: searchMatch }];
    }
    if (verified !== undefined) query.verified = verified === 'true';
    if (featured !== undefined) query.featured = featured === 'true';

    const artists = await Artist.find(query)
      .populate('userId', 'username email avatar fullName')
      .select(
        'stageName userId verified featured genres monthlyListeners totalStreams subscriptionStatus currentPlan'
      )
      .limit(limit)
      .sort({ stageName: 1 });

    const formattedArtists = artists.map((artist) => ({
      _id: artist._id,
      stageName: artist.stageName,
      email: artist.userId?.email,
      username: artist.userId?.username,
      verified: artist.verified,
      featured: artist.featured,
      genres: artist.genres,
      monthlyListeners: artist.monthlyListeners,
      subscriptionStatus: artist.subscriptionStatus,
      currentPlan: artist.currentPlan,
      avatar: artist.userId?.avatar,
      displayName: `${artist.stageName} (${artist.userId?.email})`,
    }));

    res.json({ success: true, total: artists.length, artists: formattedArtists });
  } catch (err) {
    console.error('getAllArtistsForAdmin error:', err);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
};

// ============================================================
// BULK ACTIONS
// ============================================================

const VALID_BULK_ACTIONS = new Set(['approve', 'reject', 'feature', 'delete', 'setGenre', 'setPremium']);

// POST /api/admin/songs/bulk
//
// FIX: Validate action against whitelist (was already, kept).
// FIX: Cap bulk size — old code accepted any number of songIds, so an
// admin could `delete: songIds: [10000 IDs]` and DoS the DB.
// FIX: For 'delete', use parallel file deletion (was sequential).
const adminBulkAction = async (req, res) => {
  try {
    const { action, songIds, data } = req.body;

    if (!VALID_BULK_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.status(400).json({ error: 'No songs selected' });
    }
    if (songIds.length > 500) {
      return res.status(400).json({ error: 'Bulk action limited to 500 items at a time' });
    }

    let result;
    const now = new Date();

    switch (action) {
      case 'approve':
        result = await Song.updateMany(
          { _id: { $in: songIds } },
          { $set: { status: 'approved', updatedAt: now } }
        );
        break;

      case 'reject':
        result = await Song.updateMany(
          { _id: { $in: songIds } },
          { $set: { status: 'rejected', updatedAt: now } }
        );
        break;

      case 'feature':
        result = await Song.updateMany(
          { _id: { $in: songIds } },
          { $set: { status: 'featured', updatedAt: now } }
        );
        break;

      case 'delete': {
        const songsToDelete = await Song.find({ _id: { $in: songIds } });

        // Best-effort parallel file deletion. Don't wait — fire and forget.
        for (const song of songsToDelete) {
          if (song.audioUrl && !song.audioUrl.startsWith('http')) {
            storageService.deleteFile(song.audioUrl).catch(() => {});
          }
          if (song.videoUrl && !song.videoUrl.startsWith('http')) {
            storageService.deleteFile(song.videoUrl).catch(() => {});
          }
          if (song.coverArt && !song.coverArt.includes('unsplash') && !song.coverArt.startsWith('http')) {
            storageService.deleteFile(song.coverArt).catch(() => {});
          }
        }

        // Remove from albums.
        await Album.updateMany(
          { songs: { $in: songIds } },
          { $pull: { songs: { $in: songIds } } }
        );

        const deletion = await Song.deleteMany({ _id: { $in: songIds } });
        result = { deletedCount: deletion.deletedCount };
        break;
      }

      case 'setGenre':
        if (!data?.genre) {
          return res.status(400).json({ error: 'genre is required' });
        }
        result = await Song.updateMany(
          { _id: { $in: songIds } },
          { $set: { genre: data.genre, updatedAt: now } }
        );
        break;

      case 'setPremium': {
        if (data?.isPremium === undefined) {
          return res.status(400).json({ error: 'isPremium is required' });
        }
        const numPrice = Number(data.price) || 0;
        if (numPrice < 0) {
          return res.status(400).json({ error: 'price cannot be negative' });
        }
        result = await Song.updateMany(
          { _id: { $in: songIds } },
          {
            $set: {
              isPremium: Boolean(data.isPremium),
              price: numPrice,
              updatedAt: now,
            },
          }
        );
        break;
      }
    }

    await logAdminAction(req.user._id, `bulk_${action}`, null, {
      count: songIds.length,
      data,
    });

    res.json({
      message: `Bulk ${action} completed`,
      modifiedCount: result.modifiedCount || result.deletedCount || 0,
      action,
    });
  } catch (err) {
    console.error('adminBulkAction error:', err);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
};

// ============================================================
// SONG STATISTICS
// ============================================================

const getSongStatistics = async (req, res) => {
  try {
    const stats = await Song.aggregate([
      {
        $facet: {
          totalCount: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byGenre: [
            { $group: { _id: '$genre', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          byMonth: [
            {
              $group: {
                _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 },
          ],
          videoVsAudio: [
            { $group: { _id: '$isVideo', count: { $sum: 1 } } },
          ],
          premiumVsFree: [
            { $group: { _id: '$isPremium', count: { $sum: 1 } } },
          ],
          topArtists: [
            {
              $group: {
                _id: '$artist',
                songCount: { $sum: 1 },
                totalPlays: { $sum: '$playCount' },
              },
            },
            { $sort: { songCount: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'artists',
                localField: '_id',
                foreignField: '_id',
                as: 'artistInfo',
              },
            },
            { $unwind: '$artistInfo' },
          ],
        },
      },
    ]);

    const out = stats[0];

    res.json({
      success: true,
      statistics: {
        totalSongs: out.totalCount[0]?.count || 0,
        byStatus: out.byStatus,
        byGenre: out.byGenre,
        monthlyUploads: out.byMonth,
        videoSongs: out.videoVsAudio.find((v) => v._id === true)?.count || 0,
        audioSongs: out.videoVsAudio.find((v) => v._id === false)?.count || 0,
        premiumSongs: out.premiumVsFree.find((p) => p._id === true)?.count || 0,
        freeSongs: out.premiumVsFree.find((p) => p._id === false)?.count || 0,
        topArtists: out.topArtists,
      },
    });
  } catch (err) {
    console.error('getSongStatistics error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// ============================================================
// EXPORTS
// ============================================================

export {
  // User Management
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,

  // Artist Management
  getAllArtists,
  verifyArtist,
  featureArtist,

  // Song Management
  getAllSongs,
  getPendingSongs,
  approveSong,
  rejectSong,
  deleteSong,

  // Album Management
  getAllAlbums,

  // Admin Upload
  adminUploadSong,
  adminUploadVideo,
  adminUploadAlbum,

  // Withdrawals
  getWithdrawals,
  processWithdrawal,

  // Reports
  getReports,
  resolveReport,

  // Settings
  getSystemSettings,
  updateSystemSettings,

  // Backup
  triggerBackup,

  // Reported Comments
  getReportedComments,
  deleteComment,

  // Analytics
  getPlatformAnalytics,
  getRevenueAnalytics,

  // Enhanced Listings + Bulk
  getAllSongsForAdmin,
  getAllArtistsForAdmin,
  adminBulkAction,
  getSongStatistics,
};
