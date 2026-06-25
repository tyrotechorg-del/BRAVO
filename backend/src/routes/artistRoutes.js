import express from 'express';
import {
  getDashboard,
  getAnalytics,
  getEarnings,
  updateArtistProfile,
  getArtistSongs,
  getArtistAlbums,
  requestWithdrawal,
  getWithdrawalHistory,
  purchaseUploadCredits,
  getSubscriptionStatus,
  uploadVideoSong,
  publishAlbum,
  getArtistVideos,
  uploadAlbum,
  getArtistById,
} from '../controllers/artistController.js';
import { auth, requireRole, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Shared guard for artist-owner actions. Applied per-route (not as a global
// router.use) so the public GET /:id below can stay unauthenticated.
const artistAuth = [auth, requireRole(['artist', 'admin'])];

router.get('/dashboard', artistAuth, getDashboard);
router.get('/analytics', artistAuth, getAnalytics);
router.get('/earnings', artistAuth, getEarnings);
router.put('/profile', artistAuth, upload.single('banner'), updateArtistProfile);
router.get('/songs', artistAuth, getArtistSongs);
router.get('/albums', artistAuth, getArtistAlbums);

router.post('/withdraw', artistAuth, requestWithdrawal);
router.get('/withdrawals', artistAuth, getWithdrawalHistory);
router.post('/purchase-credits', artistAuth, purchaseUploadCredits);
router.get('/subscription', artistAuth, getSubscriptionStatus);

// Upload routes use the upload rate limiter (10/hour).
router.post(
  '/upload-video',
  artistAuth,
  uploadLimiter,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
  ]),
  uploadVideoSong
);

router.post('/upload-album', artistAuth, uploadLimiter, upload.single('coverArt'), uploadAlbum);

router.put('/album/:albumId/publish', artistAuth, publishAlbum);
router.get('/videos', artistAuth, getArtistVideos);

// Public artist profile by id — declared LAST so the literal routes above take
// precedence over the `/:id` wildcard. optionalAuth populates `isFollowing`
// for logged-in viewers.
router.get('/:id', optionalAuth, getArtistById);

export default router;
