import express from 'express';
import { 
  getProfile, updateProfile, getFollowers, getFollowing, 
  followUser, unfollowUser, getListeningHistory, getUserPlaylists,
  getSettings, updateSettings, deleteAccount
} from '../controllers/userController.js';
import { auth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.get('/profile', auth, getProfile);
router.put('/profile', auth, upload.single('avatar'), updateProfile);
router.get('/followers', auth, getFollowers);
router.get('/following', auth, getFollowing);
router.post('/follow/:userId', auth, followUser);
router.delete('/unfollow/:userId', auth, unfollowUser);
router.get('/history', auth, getListeningHistory);
router.get('/playlists', auth, getUserPlaylists);
router.get('/settings', auth, getSettings);
router.put('/settings', auth, updateSettings);
router.delete('/account', auth, deleteAccount);

export default router;