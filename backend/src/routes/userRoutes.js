import express from 'express';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  getListeningHistory,
  getUserPlaylists,
  getMyLiked,
  getSettings,
  updateSettings,
  deleteAccount,
} from '../controllers/userController.js';
import { auth, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Own profile (settings, history, etc.)
router.get('/profile', auth, getProfile);
router.put('/profile', auth, upload.single('avatar'), updateProfile);
router.post('/profile/avatar', auth, upload.single('avatar'), uploadAvatar);

router.get('/followers', auth, getFollowers);
router.get('/following', auth, getFollowing);
router.post('/follow/:userId', auth, followUser);
router.delete('/unfollow/:userId', auth, unfollowUser);

router.get('/history', auth, getListeningHistory);
router.get('/playlists', auth, getUserPlaylists);
router.get('/liked', auth, getMyLiked);

router.get('/settings', auth, getSettings);
router.put('/settings', auth, updateSettings);

router.delete('/account', auth, deleteAccount);

// FIX (new): Public profile lookup. The frontend needs to show artist
// and listener profiles by ID — there was no route for this before, so
// pages showing "View [username]'s profile" had nothing to call. Returns
// only public fields. Implemented inline because it's a tiny endpoint
// and didn't justify a controller change in this batch — flagged for a
// future userController patch if it grows.
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      'username fullName avatar bio location socialLinks role createdAt'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    let artistProfile = null;
    if (user.role === 'artist') {
      artistProfile = await Artist.findOne({ userId: user._id }).select(
        'stageName verified featured genres bannerImage monthlyListeners totalStreams bio'
      );
    }

    res.json({
      user: user.toJSON(),
      artistProfile,
      // The viewer can decide whether to show a "Follow" button based
      // on whether they're logged in (req.user set).
      isOwnProfile: req.user && req.user._id.toString() === user._id.toString(),
    });
  } catch (err) {
    console.error('GET /users/:userId error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
