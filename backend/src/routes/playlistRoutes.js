import express from 'express';
import { 
  createPlaylist, getUserPlaylists, getPlaylist, updatePlaylist,
  deletePlaylist, addSongToPlaylist, removeSongFromPlaylist, likePlaylist, getFeaturedPlaylists
} from '../controllers/playlistController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/create', auth, createPlaylist);
router.get('/', auth, getUserPlaylists);
router.get('/featured', getFeaturedPlaylists);
router.get('/:id', auth, getPlaylist);
router.put('/:id', auth, updatePlaylist);
router.delete('/:id', auth, deletePlaylist);
router.post('/:id/add-song', auth, addSongToPlaylist);
router.delete('/:id/remove-song', auth, removeSongFromPlaylist);
router.post('/:id/like', auth, likePlaylist);

export default router;