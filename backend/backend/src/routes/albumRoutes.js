import express from 'express';
import {
  createAlbum,
  getAlbums,
  getAlbum,
  updateAlbum,
  deleteAlbum,
  addSongToAlbum,
  removeSongFromAlbum,
  purchaseAlbum,
  getTrendingAlbums,
  getArtistAlbums,
} from '../controllers/albumController.js';
import { auth, requireRole, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// FIX: Use optionalAuth for public reads. Our fixed controller records
// view analytics when req.user is present — guests still flow through
// but their views are recorded as user: null.
router.get('/', optionalAuth, getAlbums);
router.get('/trending', getTrendingAlbums);
router.get('/:id', optionalAuth, getAlbum);

// Artist / admin write routes
router.post(
  '/create',
  auth,
  requireRole(['artist', 'admin']), // FIX: admins can create on behalf of artists
  upload.single('coverArt'),
  createAlbum
);

router.put(
  '/:id',
  auth,
  requireRole(['artist', 'admin']),
  upload.single('coverArt'),
  updateAlbum
);

router.delete('/:id', auth, requireRole(['artist', 'admin']), deleteAlbum);

router.post('/:id/add-song', auth, requireRole(['artist', 'admin']), addSongToAlbum);
router.delete('/:id/remove-song', auth, requireRole(['artist', 'admin']), removeSongFromAlbum);

// Anyone authenticated can purchase
router.post('/:id/purchase', auth, purchaseAlbum);

// FIX: optionalAuth — viewing an artist's catalog is public. The
// controller checks `req.user` to decide whether to include drafts
// (only when the requester IS the artist).
router.get('/artist/:userId', optionalAuth, getArtistAlbums);

// Convenience: my albums (current artist)
router.get(
  '/my/albums',
  auth,
  (req, res, next) => {
    req.params.userId = 'me';
    next();
  },
  getArtistAlbums
);

export default router;
