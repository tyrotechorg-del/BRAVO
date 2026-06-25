import express from 'express';
import {
  searchAll,
  searchSongs,
  searchArtists,
  searchAlbums,
  searchPlaylists,
  getSuggestions,
} from '../controllers/searchController.js';
import { cache } from '../middleware/cache.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// FIX: Added search rate limiter (60 queries/min/user). Search runs
// case-insensitive regex over collections — even with the ReDoS fix
// from batch 3, a flood of distinct queries can starve the DB. The
// limiter is per-user-or-IP so legitimate use (autocomplete) is fine.
//
// Cache is layered ABOVE the limiter so cache hits don't consume
// rate-limit budget. Empty/short queries hit the controller's
// validation and return immediately — they should still count to
// prevent enumeration.
router.get('/all', searchLimiter, cache(300), searchAll);
router.get('/songs', searchLimiter, cache(300), searchSongs);
router.get('/artists', searchLimiter, cache(300), searchArtists);
router.get('/albums', searchLimiter, cache(300), searchAlbums);
router.get('/playlists', searchLimiter, cache(300), searchPlaylists);

// Suggestions has a higher implicit allowance because it's called on
// every keystroke. The 60/min limiter still applies; cache at 60s.
router.get('/suggestions', searchLimiter, cache(60), getSuggestions);

export default router;
