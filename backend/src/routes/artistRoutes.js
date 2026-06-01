import express from 'express';
import { 
  getDashboard, getAnalytics, getEarnings, updateArtistProfile,
  getArtistSongs, getArtistAlbums, requestWithdrawal, getWithdrawalHistory,
  purchaseUploadCredits, getSubscriptionStatus, uploadVideoSong, publishAlbum, getArtistVideos, uploadAlbum
} from '../controllers/artistController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(auth, requireRole(['artist']));

router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);
router.get('/earnings', getEarnings);
router.put('/profile', upload.single('banner'), updateArtistProfile);
router.get('/songs', getArtistSongs);
router.get('/albums', getArtistAlbums);
router.post('/withdraw', requestWithdrawal);
router.get('/withdrawals', getWithdrawalHistory);
router.post('/purchase-credits', purchaseUploadCredits);
router.get('/subscription', getSubscriptionStatus);

// Video upload
router.post('/upload-video',
    upload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'coverArt', maxCount: 1 }
    ]),
    uploadVideoSong
);

// Album management
router.post('/upload-album',
    upload.single('coverArt'),
    uploadAlbum
);

router.put('/album/:albumId/publish', publishAlbum);
router.get('/videos', getArtistVideos);

// Existing routes remain...

export default router;