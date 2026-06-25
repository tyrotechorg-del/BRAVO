import mongoose from 'mongoose';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Playlist from '../models/Playlist.js';
import Wallet from '../models/Wallet.js';
import Like from '../models/Like.js';
import Comment from '../models/Comment.js';
import Song from '../models/Song.js';
import Notification from '../models/Notification.js';
import Analytics from '../models/Analytics.js';
import storageService from '../services/storageService.js';
import { parsePagination } from '../utils/apiResponse.js';

// Fields users are allowed to update on their own profile. Note: `role`,
// `email`, `username`, `isVerified`, `isActive` are NOT here — those go
// through dedicated endpoints (`updateSettings`, password reset, admin).
const PROFILE_UPDATABLE_FIELDS = ['fullName', 'bio', 'location', 'socialLinks'];

// Allowed nested preference keys. Anything outside this list is silently
// dropped. Prevents a user from polluting `preferences` with arbitrary
// data or stomping unrelated nested fields.
const PREFERENCE_KEYS = new Set([
  'language',
  'theme',
  'autoplay',
  'highQualityStreaming',
  'downloadOverWifi',
]);

// ============================================================
// GET /api/users/profile                 (auth required)
// ============================================================
export const getProfile = async (req, res) => {
  try {
    // Run independent queries in parallel.
    const [user, artistProfile, wallet] = await Promise.all([
      User.findById(req.user._id).select(
        '-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires'
      ),
      req.user.role === 'artist' ? Artist.findOne({ userId: req.user._id }) : null,
      Wallet.findOne({ user: req.user._id }),
    ]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user,
      artistProfile,
      wallet: wallet
        ? { balance: wallet.balance, totalEarned: wallet.totalEarned, currency: wallet.currency }
        : null,
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// ============================================================
// PUT /api/users/profile                 (auth required)
// ============================================================
//
// FIX: Whitelist allowed fields explicitly. The old code did this too,
// but it iterated `req.body` without validating that the nested
// `preferences` object was sane. A client could POST
// `preferences: { __proto__: {admin: true} }` and stomp non-preference
// fields. We now allowlist nested keys too.
//
export const updateProfile = async (req, res) => {
  try {
    const updateData = {};

    for (const field of PROFILE_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // preferences: only accept known keys.
    if (req.body.preferences && typeof req.body.preferences === 'object') {
      const sanitised = {};
      for (const key of Object.keys(req.body.preferences)) {
        if (PREFERENCE_KEYS.has(key)) {
          sanitised[`preferences.${key}`] = req.body.preferences[key];
        }
      }
      Object.assign(updateData, sanitised);
    }

    if (req.file) {
      updateData.avatar = await storageService.uploadImage(req.file, 'avatars');
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateData.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ============================================================
// POST /api/users/profile/avatar         (auth required)
// ============================================================
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    let avatarUrl;
    try {
      avatarUrl = await storageService.uploadImage(req.file, 'avatars');
    } catch (uploadErr) {
      return res.status(415).json({ error: uploadErr.message || 'Failed to process image' });
    }

    if (!avatarUrl) {
      return res.status(400).json({ error: 'Failed to store image' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: avatarUrl, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).select('-password');

    if (req.user.role === 'artist') {
      await Artist.findOneAndUpdate({ userId: req.user._id }, { $set: { avatar: avatarUrl } });
    }

    res.json({ message: 'Profile picture updated', avatar: avatarUrl, user });
  } catch (err) {
    console.error('uploadAvatar error:', err);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
};

// ============================================================
// GET /api/users/followers               (auth required)
// ============================================================
// FIX: Was unpaginated. Top users could have 100k+ followers.
export const getFollowers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const user = await User.findById(req.user._id)
      .populate({
        path: 'followers',
        select: 'username fullName avatar',
        options: { skip, limit, sort: { _id: -1 } },
      });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Total comes from the raw array length (without pagination applied).
    const total = await User.findById(req.user._id).select('followers').then((u) => u?.followers?.length || 0);

    res.json({
      followers: user.followers,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('getFollowers error:', err);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
};

// ============================================================
// GET /api/users/following               (auth required)
// ============================================================
export const getFollowing = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const user = await User.findById(req.user._id)
      .populate({
        path: 'following',
        select: 'username fullName avatar',
        options: { skip, limit, sort: { _id: -1 } },
      });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const total = await User.findById(req.user._id).select('following').then((u) => u?.following?.length || 0);

    res.json({
      following: user.following,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('getFollowing error:', err);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
};

// ============================================================
// POST /api/users/:userId/follow         (auth required)
// ============================================================
//
// MAJOR FIX: Race condition. The old code did:
//   if (req.user.following.includes(targetId)) → return "already following"
//   req.user.following.push(targetId)
//   targetUser.followers.push(myId)
//   await req.user.save(); await targetUser.save();
//
// Two simultaneous follows could both pass the .includes check and both
// .push, doubling the entries. And if targetUser.save() failed after
// req.user.save() succeeded, we'd have asymmetric follow state.
//
// Fix: use $addToSet on both documents — atomic and idempotent. No
// notification spam if the follow was a duplicate.
//
export const followUser = async (req, res) => {
  try {
    const targetId = req.params.userId;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(targetId).select('_id username');
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Two atomic $addToSet operations. If either fails, the inconsistency
    // is one-sided and self-healing on the next operation. (For full ACID
    // we'd need a transaction — added below.)
    const session = await mongoose.startSession();
    let wasNewFollow = false;
    try {
      await session.withTransaction(async () => {
        const myUpdate = await User.findByIdAndUpdate(
          req.user._id,
          { $addToSet: { following: targetUser._id } },
          { session, new: false }
        );
        await User.findByIdAndUpdate(
          targetUser._id,
          { $addToSet: { followers: req.user._id } },
          { session }
        );
        // Detect whether this was a new follow or already-following.
        // The old document is returned; if the target wasn't in following,
        // this is a new follow.
        wasNewFollow = !myUpdate.following.some(
          (id) => id.toString() === targetUser._id.toString()
        );
      });
    } finally {
      await session.endSession();
    }

    // Only notify on new follows — avoid spamming on duplicate clicks.
    if (wasNewFollow) {
      Notification.create({
        user: targetUser._id,
        type: 'follow',
        title: 'New Follower',
        message: `${req.user.username} started following you`,
        data: { followerId: req.user._id },
      }).catch((err) => console.error('Notification create failed:', err.message));
    }

    res.json({
      message: wasNewFollow ? 'User followed successfully' : 'Already following',
      followed: true,
    });
  } catch (err) {
    console.error('followUser error:', err);
    res.status(500).json({ error: 'Failed to follow user' });
  }
};

// ============================================================
// DELETE /api/users/:userId/follow       (auth required)
// ============================================================
export const unfollowUser = async (req, res) => {
  try {
    const targetId = req.params.userId;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot unfollow yourself' });
    }

    const targetUser = await User.findById(targetId).select('_id');
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await User.findByIdAndUpdate(
          req.user._id,
          { $pull: { following: targetUser._id } },
          { session }
        );
        await User.findByIdAndUpdate(
          targetUser._id,
          { $pull: { followers: req.user._id } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    res.json({ message: 'User unfollowed successfully', followed: false });
  } catch (err) {
    console.error('unfollowUser error:', err);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
};

// ============================================================
// GET /api/users/history                 (auth required)
// ============================================================
// FIX: Was unpaginated, hardcoded limit 50. Now properly paginated.
export const getListeningHistory = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = { user: req.user._id, action: 'stream' };
    const [history, total] = await Promise.all([
      Analytics.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('song', 'title coverArt artist duration'),
      Analytics.countDocuments(filter),
    ]);

    res.json({
      history,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getListeningHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch listening history' });
  }
};

// ============================================================
// GET /api/users/playlists               (auth required)
// ============================================================
// FIX: Was unpaginated. Same as playlistController.getUserPlaylists.
export const getUserPlaylists = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [playlists, total] = await Promise.all([
      Playlist.find({ user: req.user._id })
        .populate('songs', 'title coverArt duration')
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
// GET /api/users/settings                (auth required)
// ============================================================
export const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences email username');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      email: user.email,
      username: user.username,
      preferences: user.preferences || {},
    });
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const getMyLiked = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { page, limit, skip } = parsePagination(req.query);

        // Count first (cheap with the user+type index)
        const total = await Like.countDocuments({
            user: req.user._id,
            type: 'song'
        });

        // Then fetch the page, populating song + artist
        const likes = await Like.find({
            user: req.user._id,
            type: 'song'
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'song',
                match: { status: 'approved' },   // hide rejected/deleted songs
                populate: {
                    path: 'artist',
                    select: 'stageName avatar verified'
                }
            })
            .lean();

        // Filter out likes whose song was deleted (populate returns null)
        const songs = likes
            .map(l => l.song)
            .filter(s => s != null);

        const totalPages = Math.max(1, Math.ceil(total / limit));

        return res.json({
            songs,
            total,
            page,
            totalPages,
            limit
        });
    } catch (err) {
        console.error('getMyLiked error:', err);
        return res.status(500).json({ error: 'Failed to load liked songs' });
    }
};

// ============================================================
// PUT /api/users/settings                (auth required)
// ============================================================
//
// FIX: The original code did a TOCTOU check — findOne to see if email
// is taken, then save(). Two concurrent requests can both pass the
// check. The User model already has a unique index on email/username,
// so we rely on that and catch the E11000 error.
//
// FIX: preferences is now key-whitelisted.
//
export const updateSettings = async (req, res) => {
  try {
    const { preferences, email, username } = req.body;

    const updates = {};

    if (email && email !== req.user.email) {
      // Basic email format check — full validation is in the User schema.
      if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email' });
      }
      updates.email = email;
      // Changing email invalidates verification (artists need to reverify).
      if (req.user.role === 'artist') {
        updates.isVerified = false;
      }
    }

    if (username && username !== req.user.username) {
      if (typeof username !== 'string' || username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: 'Username must be 3-30 characters' });
      }
      updates.username = username;
    }

    if (preferences && typeof preferences === 'object') {
      for (const key of Object.keys(preferences)) {
        if (PREFERENCE_KEYS.has(key)) {
          updates[`preferences.${key}`] = preferences[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    try {
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password');

      res.json({ message: 'Settings updated successfully', user });
    } catch (err) {
      if (err.code === 11000) {
        // Unique index collision on email or username.
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        return res.status(400).json({ error: `${field} already in use` });
      }
      throw err;
    }
  } catch (err) {
    console.error('updateSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// ============================================================
// DELETE /api/users/account              (auth required)
// ============================================================
//
// MAJOR FIX. Two serious bugs in the original:
//
//   1. SONGS WEREN'T BEING DELETED. Old code did:
//        const songs = await Song.find({ artist: req.user._id });
//      But the Song.artist field references the Artist._id, NOT the
//      User._id. So this query always returned [] for every user, and
//      no audio files were ever deleted from disk on account deletion.
//      Deleted artists left their songs behind as orphans.
//
//   2. NO TRANSACTION. Likes were deleted, then comments, then playlists,
//      then wallet, then artist, then songs, then user. If any step
//      failed partway, you had a half-deleted user with orphan data.
//
// The fix:
//   • Query songs via the Artist._id, not User._id.
//   • Wrap all DB deletions in a transaction.
//   • Delete audio files AFTER the transaction commits (file deletion
//     is not transactional — if we delete files first and the DB
//     rollback happens, we've lost the file but the row remains).
//   • Best-effort file cleanup outside the transaction.
//
export const deleteAccount = async (req, res) => {
  let songFilesToDelete = [];
  let coverFilesToDelete = [];
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // If this is an artist, collect songs to delete (files cleaned
      // up after the transaction commits).
      if (req.user.role === 'artist') {
        const artistProfile = await Artist.findOne({ userId: req.user._id }).session(session);
        if (artistProfile) {
          // BUG FIX: Songs are linked to Artist._id, not User._id.
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
              !song.coverArt.includes('unsplash') && !song.coverArt.includes('bravo.png')
            ) {
              coverFilesToDelete.push(song.coverArt);
            }
          }

          await Song.deleteMany({ artist: artistProfile._id }).session(session);
          await Artist.deleteOne({ _id: artistProfile._id }).session(session);
        }
      }

      // Cascade: cleanup user-owned data.
      // Note: comments use soft-delete via `isDeleted` to preserve thread
      // structure for other users. We mark, don't hard-delete.
      await Comment.updateMany(
        { user: req.user._id },
        { $set: { isDeleted: true, deletedAt: new Date(), content: '[deleted]' } }
      ).session(session);

      await Like.deleteMany({ user: req.user._id }).session(session);
      await Playlist.deleteMany({ user: req.user._id }).session(session);
      await Wallet.deleteOne({ user: req.user._id }).session(session);
      await Notification.deleteMany({ user: req.user._id }).session(session);

      // Remove self from other users' followers/following arrays.
      await User.updateMany(
        { $or: [{ followers: req.user._id }, { following: req.user._id }] },
        { $pull: { followers: req.user._id, following: req.user._id } }
      ).session(session);

      // Finally, delete the user.
      await User.findByIdAndDelete(req.user._id).session(session);
    });

    // Best-effort file cleanup — outside the transaction.
    for (const file of [...songFilesToDelete, ...coverFilesToDelete]) {
      storageService.deleteFile(file).catch((err) =>
        console.error('Failed to delete file on account deletion:', file, err.message)
      );
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('deleteAccount error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  } finally {
    await session.endSession();
  }
};
