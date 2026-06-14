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
} from '../controllers/artistController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// FIX: Was `requireRole(['artist'])` which EXCLUDED admins entirely.
// Admins couldn't trigger artist actions or view artist dashboards.
// Now allows both — the controller looks up the artist profile via
// req.user._id, so admins can only act on their own (if they happen
// to also have an Artist profile). For acting on OTHER artists, admins
// use /api/admin/* endpoints.
router.use(auth, requireRole(['artist', 'admin']));

router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);
router.get('/earnings', getEarnings);
router.put('/profile', upload.single('banner'), updateArtistProfile);
router.get('/songs', getArtistSongs);
router.get('/albums', getArtistAlbums);

router.post('/withdraw', requestWithdrawal);
router.get('/withdrawals', getWithdrawalHistory);
router.post('/purchase-credits', purchaseUploadCredits);
router.get('/subscription', getSubscriptionStatus);

// Upload routes use the upload rate limiter (10/hour).
router.post(
  '/upload-video',
  uploadLimiter,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
  ]),
  uploadVideoSong
);

router.post('/upload-album', uploadLimiter, upload.single('coverArt'), uploadAlbum);

router.put('/album/:albumId/publish', publishAlbum);
router.get('/videos', getArtistVideos);

export default router;
