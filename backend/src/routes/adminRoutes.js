import express from 'express';
import { 
    // User Management
    getAllUsers, getUserDetails, updateUserStatus, deleteUser,
    
    // Artist Management
    getAllArtists, getAllArtistsForAdmin, verifyArtist, featureArtist,
    
    // Song Management
    getAllSongs, getPendingSongs, approveSong, rejectSong, deleteSong,
    getAllSongsForAdmin, getSongStatistics, adminBulkAction,
    
    // Album Management
    getAllAlbums,
    
    // Admin Upload
    adminUploadSong, adminUploadVideo, adminUploadAlbum,
    
    // Financial Management
    getWithdrawals, processWithdrawal,
    
    // Reports & Moderation
    getReports, resolveReport, getReportedComments, deleteComment,
    
    // Analytics
    getPlatformAnalytics, getRevenueAnalytics,
    
    // Settings & Backup
    getSystemSettings, updateSystemSettings, triggerBackup
    
} from '../controllers/adminController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Apply admin authentication to all routes
router.use(auth, requireRole(['admin']));

// ============ USER MANAGEMENT ============
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserDetails);
router.put('/users/:userId/status', updateUserStatus);
router.delete('/users/:userId', deleteUser);

// ============ ARTIST MANAGEMENT ============
router.get('/artists', getAllArtists);
router.get('/artists/list', getAllArtistsForAdmin);
router.post('/artists/:artistId/verify', verifyArtist);
router.post('/artists/:artistId/feature', featureArtist);

// ============ SONG MANAGEMENT ============
router.get('/songs', getAllSongs);
router.get('/songs/pending', getPendingSongs);
router.get('/songs/all', getAllSongsForAdmin);
router.get('/songs/statistics', getSongStatistics);
router.post('/songs/:songId/approve', approveSong);
router.post('/songs/:songId/reject', rejectSong);
router.delete('/songs/:songId', deleteSong);
router.post('/songs/bulk-action', adminBulkAction);

// ============ ALBUM MANAGEMENT ============
router.get('/albums', getAllAlbums);
router.delete('/albums/:albumId', async (req, res) => {
    try {
        const Album = await import('../models/Album.js');
        const album = await Album.default.findByIdAndDelete(req.params.albumId);
        if (!album) return res.status(404).json({ error: 'Album not found' });
        res.json({ message: 'Album deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete album' });
    }
});

// ============ ADMIN UPLOAD ============
router.post('/upload-song', 
    upload.fields([
        { name: 'audio', maxCount: 1 },
        { name: 'coverArt', maxCount: 1 }
    ]), 
    adminUploadSong
);

router.post('/upload-video', 
    upload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'coverArt', maxCount: 1 },
        { name: 'audio', maxCount: 1 }
    ]), 
    adminUploadVideo
);

router.post('/upload-album',
    upload.single('coverArt'),
    adminUploadAlbum
);

// ============ FINANCIAL MANAGEMENT ============
router.get('/withdrawals', getWithdrawals);
router.get('/withdrawals/all', getWithdrawals);
router.post('/withdrawals/:withdrawalId/process', processWithdrawal);

// ============ PLATFORM ANALYTICS ============
router.get('/analytics', getPlatformAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/overview', getPlatformAnalytics);

// ============ SYSTEM CONFIGURATION ============
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);
router.post('/backup', triggerBackup);

// ============ MODERATION ============
router.get('/comments/reported', getReportedComments);
router.delete('/comments/:commentId', deleteComment);
router.get('/reports', getReports);
router.post('/reports/:reportId/resolve', resolveReport);

export default router;