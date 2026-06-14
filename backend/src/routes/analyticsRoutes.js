import express from 'express';
import {
  getStreamAnalytics,
  getDownloadAnalytics,
  getRevenueAnalytics,
  getTopSongs,
  getTopArtists,
  getUserEngagement,
  getGeographicAnalytics,
} from '../controllers/analyticsController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Streams + downloads are scoped to the requester (artist sees their
// own, admin sees global). The controller enforces this. Auth required.
router.get('/streams', auth, getStreamAnalytics);
router.get('/downloads', auth, getDownloadAnalytics);

// FIX: Revenue, top-songs/artists, engagement, geographic are all
// platform-level data — admin-only at the controller and now at the
// route too. Previously some of these had NO auth at all, meaning the
// controller's 403 was the only line of defense (worked, but failing
// fast at the route is the right pattern).
router.get('/revenue', auth, requireRole(['admin']), getRevenueAnalytics);
router.get('/top-songs', auth, requireRole(['admin']), getTopSongs);
router.get('/top-artists', auth, requireRole(['admin']), getTopArtists);
router.get('/user-engagement', auth, requireRole(['admin']), getUserEngagement);
router.get('/geographic', auth, requireRole(['admin']), getGeographicAnalytics);

export default router;
