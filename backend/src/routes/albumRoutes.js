import express from 'express';
import { 
  createAlbum, getAlbums, getAlbum, updateAlbum, deleteAlbum,
  addSongToAlbum, removeSongFromAlbum, purchaseAlbum, getTrendingAlbums,
  getArtistAlbums
} from '../controllers/albumController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public routes
router.get('/', getAlbums);
router.get('/trending', getTrendingAlbums);
router.get('/:id', getAlbum);

// Artist routes
router.post('/create', 
  auth, 
  requireRole(['artist']), 
  upload.single('coverArt'), 
  createAlbum
);

router.put('/:id', 
  auth, 
  requireRole(['artist', 'admin']), 
  upload.single('coverArt'), 
  updateAlbum
);

router.delete('/:id', 
  auth, 
  requireRole(['artist', 'admin']), 
  deleteAlbum
);

router.post('/:id/add-song', 
  auth, 
  requireRole(['artist']), 
  addSongToAlbum
);

router.delete('/:id/remove-song', 
  auth, 
  requireRole(['artist']), 
  removeSongFromAlbum
);

router.post('/:id/purchase', 
  auth, 
  purchaseAlbum
);

// Get artist albums
router.get('/artist/:userId', 
  auth, 
  getArtistAlbums
);

// Get my albums (current user)
router.get('/my/albums', 
  auth, 
  (req, res, next) => {
    req.params.userId = 'me';
    next();
  },
  getArtistAlbums
);

export default router;