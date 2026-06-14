import express from 'express';
import {
  getSongs,
  getSong,
  uploadSong,
  likeSong,
  unlikeSong,
  getTrendingSongs,
  getFeaturedSongs,
  getRecentSongs,
  streamSong,
  getSongsByArtist,
  getSongsByGenre,
  shareSong,
  getSongComments,
  deleteSong,
  getAllVideos,
  streamVideo,
} from '../controllers/songController.js';
import { auth, requireRole, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { cache } from '../middleware/cache.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ============================================================
// ROUTE ORDER MATTERS
// ============================================================
// Express matches in registration order. All `/:id` routes must come
// AFTER static-path routes like `/trending`, `/videos`, `/featured`,
// otherwise Express will match `/:id` first with id="videos" and the
// real videos handler is never reached.
//
// FIX: `/videos` was registered AFTER `/:id` in the original code.
// The endpoint was completely dead — calling `GET /api/songs/videos`
// would hit `getSong` with `id="videos"` and 404.

// ---- Upload (must be first to avoid colliding with /:id) ----
router.post(
  '/upload',
  auth,
  requireRole(['artist', 'admin']),
  uploadLimiter,
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
  ]),
  uploadSong
);

// ---- Static-path public routes (must come BEFORE /:id) ----
router.get('/', cache(300), getSongs);
router.get('/trending', cache(300), getTrendingSongs);
router.get('/featured', cache(300), getFeaturedSongs);
router.get('/recent', cache(300), getRecentSongs);
router.get('/videos', cache(300), getAllVideos); // FIX: moved before /:id
router.get('/artist/:artistId', cache(300), getSongsByArtist);
router.get('/genre/:genre', cache(300), getSongsByGenre);

// ---- /:id and its sub-paths ----
// /:id/* (sub-paths) match before /:id because they have more segments.
router.get('/:id/comments', getSongComments);

// FIX: streamSong + streamVideo now use optionalAuth. Guests can stream
// non-premium content (matching the download flow). Premium check
// inside the controller returns 401/403 as appropriate.
router.get('/:id/stream', optionalAuth, streamSong);
router.get('/:id/stream-video', optionalAuth, streamVideo);

// State-changing endpoints
router.post('/:id/like', auth, likeSong);
router.delete('/:id/like', auth, unlikeSong);
router.post('/:id/share', optionalAuth, shareSong); // guests can share

// Single-song lookup — registered last among GETs to avoid swallowing
// static paths above.
router.get('/:id', cache(60), optionalAuth, getSong);

// Delete song — artist or admin
router.delete('/:id', auth, requireRole(['artist', 'admin']), deleteSong);

export default router;
