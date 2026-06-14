import express from 'express';
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  likePlaylist,
  getFeaturedPlaylists,
} from '../controllers/playlistController.js';
import { auth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/create', auth, createPlaylist);

// Listing your own playlists — requires auth.
router.get('/', auth, getUserPlaylists);

// Featured playlists are public — no auth.
router.get('/featured', getFeaturedPlaylists);

// FIX: getPlaylist now uses optionalAuth. Public playlists are viewable
// by anyone (guests included); private playlists return 404 to non-owners.
// The old code required strict auth, which meant guests couldn't even
// see public playlists. The controller handles both cases correctly now.
router.get('/:id', optionalAuth, getPlaylist);

router.put('/:id', auth, updatePlaylist);
router.delete('/:id', auth, deletePlaylist);
router.post('/:id/add-song', auth, addSongToPlaylist);
router.delete('/:id/remove-song', auth, removeSongFromPlaylist);
router.post('/:id/like', auth, likePlaylist);

export default router;
