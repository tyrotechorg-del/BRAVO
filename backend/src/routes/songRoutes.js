import express from 'express';
import { 
  getSongs, getSong, uploadSong, likeSong, unlikeSong, 
  getTrendingSongs, getFeaturedSongs, getRecentSongs, streamSong,
  getSongsByArtist, getSongsByGenre, shareSong, getSongComments,
  deleteSong, getAllVideos, streamVideo
} from '../controllers/songController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { cache } from '../middleware/cache.js';

const router = express.Router();

// Upload - artists and admins
router.post('/upload', 
  auth, 
  requireRole(['artist', 'admin']), 
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 }
  ]), 
  uploadSong
);

// Public routes
router.get('/', cache(300), getSongs);
router.get('/trending', cache(300), getTrendingSongs);
router.get('/featured', cache(300), getFeaturedSongs);
router.get('/recent', cache(300), getRecentSongs);
router.get('/:id', cache(60), getSong);
router.get('/artist/:artistId', cache(300), getSongsByArtist);
router.get('/genre/:genre', cache(300), getSongsByGenre);
router.get('/:id/comments', getSongComments);

// Authenticated routes
router.get('/:id/stream', auth, streamSong);
router.post('/:id/like', auth, likeSong);
router.delete('/:id/like', auth, unlikeSong);
router.post('/:id/share', auth, shareSong);

// Video endpoints
router.get('/videos', getAllVideos);
router.get('/:id/stream-video', auth, streamVideo);

// Delete song - artists and admins
router.delete('/:id', auth, requireRole(['artist', 'admin']), deleteSong);

export default router;