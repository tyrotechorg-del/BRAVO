import express from 'express';
import { downloadSong, downloadAlbum, getDownloadHistory, checkDownloadEligibility } from '../controllers/downloadController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/song/:songId', auth, downloadSong);
router.post('/album/:albumId', auth, downloadAlbum);
router.get('/history', auth, getDownloadHistory);
router.get('/check/:songId', auth, checkDownloadEligibility);

export default router;