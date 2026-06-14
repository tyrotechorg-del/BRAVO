import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  downloadSong,
  downloadAlbum,
  getDownloadHistory,
  checkDownloadEligibility,
} from '../controllers/downloadController.js';
import { auth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Tiered download rate limits.
 *
 * Logged-in users:  50 downloads / hour, keyed by user ID
 * Guests:           20 downloads / hour, keyed by IP
 *
 * Two separate limiters because the key strategy differs. Each
 * limiter's skip() ignores requests that should be counted under
 * the other limiter — so a logged-in user only counts against
 * userLimiter, a guest only against guestLimiter.
 */
const userLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.user?._id?.toString() || 'anon',
  skip: (req) => !req.user,
  message: { error: 'Download limit reached (50/hour). Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const guestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  skip: (req) => !!req.user,
  message: { error: 'Download limit reached (20/hour for guests). Sign in for a higher limit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/song/:songId', optionalAuth, userLimiter, guestLimiter, downloadSong);
router.post('/album/:albumId', optionalAuth, userLimiter, guestLimiter, downloadAlbum);
router.get('/check/:songId', optionalAuth, checkDownloadEligibility);
router.get('/history', auth, getDownloadHistory);

export default router;
