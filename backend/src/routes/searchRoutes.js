import express from 'express';
import { searchAll, searchSongs, searchArtists, searchAlbums, searchPlaylists, getSuggestions } from '../controllers/searchController.js';
import { cache } from '../middleware/cache.js';

const router = express.Router();

router.get('/all', cache(300), searchAll);
router.get('/songs', cache(300), searchSongs);
router.get('/artists', cache(300), searchArtists);
router.get('/albums', cache(300), searchAlbums);
router.get('/playlists', cache(300), searchPlaylists);
router.get('/suggestions', cache(60), getSuggestions);

export default router;