import express from 'express';
import { 
  getStreamAnalytics, getDownloadAnalytics, getRevenueAnalytics,
  getTopSongs, getTopArtists, getUserEngagement, getGeographicAnalytics
} from '../controllers/analyticsController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/streams', auth, getStreamAnalytics);
router.get('/downloads', auth, getDownloadAnalytics);
router.get('/revenue', auth, requireRole(['artist', 'admin']), getRevenueAnalytics);
router.get('/top-songs', getTopSongs);
router.get('/top-artists', getTopArtists);
router.get('/user-engagement', auth, getUserEngagement);
router.get('/geographic', getGeographicAnalytics);

export default router;