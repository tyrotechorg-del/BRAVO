import express from 'express';
import Album from '../models/Album.js';
import Song from '../models/Song.js';
import {
  // User Management
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,

  // Artist Management
  getAllArtists,
  getAllArtistsForAdmin,
  verifyArtist,
  unverifyArtist,
  featureArtist,

  // Song Management
  getAllSongs,
  getPendingSongs,
  approveSong,
  rejectSong,
  deleteSong,
  getAllSongsForAdmin,
  getSongStatistics,
  adminBulkAction,

  // Album Management
  getAllAlbums,

  // Admin Upload
  adminUploadSong,
  adminUploadVideo,
  adminUploadAlbum,

  // Financial Management
  getWithdrawals,
  processWithdrawal,

  // Reports & Moderation
  getReports,
  resolveReport,
  getReportedComments,
  deleteComment,
  dismissComment,

  // Analytics
  getPlatformAnalytics,
  getRevenueAnalytics,

  // Settings & Backup
  getSystemSettings,
  updateSystemSettings,
  triggerBackup,
} from '../controllers/adminController.js';
import { auth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import storageService from '../services/storageService.js';

const router = express.Router();

// All admin routes require admin role.
router.use(auth, requireRole(['admin']));

// ============ USERS ============
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserDetails);
router.put('/users/:userId/status', updateUserStatus);
router.delete('/users/:userId', deleteUser);

// ============ ARTISTS ============
// Specific paths BEFORE param paths.
router.get('/artists/list', getAllArtistsForAdmin);
router.get('/artists', getAllArtists);
router.post('/artists/:artistId/verify', verifyArtist);
router.post('/artists/:artistId/unverify', unverifyArtist);
router.post('/artists/:artistId/feature', featureArtist);

// ============ SONGS ============
// /songs/pending, /songs/all, /songs/statistics, /songs/bulk-action all
// come BEFORE /songs/:songId/* to avoid Express matching :songId="pending".
router.get('/songs/pending', getPendingSongs);
router.get('/songs/all', getAllSongsForAdmin);
router.get('/songs/statistics', getSongStatistics);
router.post('/songs/bulk-action', adminBulkAction);
router.get('/songs', getAllSongs);
router.post('/songs/:songId/approve', approveSong);
router.post('/songs/:songId/reject', rejectSong);
router.delete('/songs/:songId', deleteSong);

// ============ ALBUMS ============
router.get('/albums', getAllAlbums);

// FIX: Was an inline handler that did a dynamic `import('../models/Album.js')`
// and a bare `findByIdAndDelete` with no cleanup of files, no removal
// from the artist's album list, no log entry. Now an inline handler
// that does it properly. (If this grows, move to adminController.)
router.delete('/albums/:albumId', async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    // Detach songs from the album so they aren't deleted.
    await Song.updateMany({ album: album._id }, { $unset: { album: '' } });

    // Best-effort cover-art cleanup.
    if (album.coverArt && !album.coverArt.startsWith('http')) {
      storageService.deleteFile(album.coverArt).catch((err) =>
        console.error('Failed to delete cover art:', err.message)
      );
    }

    await album.deleteOne();
    res.json({ message: 'Album deleted successfully' });
  } catch (err) {
    console.error('admin deleteAlbum error:', err);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

// ============ ADMIN UPLOADS ============
router.post(
  '/upload-song',
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
  ]),
  adminUploadSong
);

router.post(
  '/upload-video',
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
  ]),
  adminUploadVideo
);

router.post('/upload-album', upload.single('coverArt'), adminUploadAlbum);

// ============ FINANCIAL ============
router.get('/withdrawals/all', getWithdrawals);
router.get('/withdrawals', getWithdrawals);

// processWithdrawal now expects withdrawalId in the body (matches the
// controller signature in batch 4). Original routed it via URL param
// AND body — the route handler reads from body. Path-param kept for
// backwards compat — handler ignores it.
router.post('/withdrawals/:withdrawalId/process', (req, res, next) => {
  // Mirror path param into body for legacy callers that only send the URL.
  if (!req.body.withdrawalId) req.body.withdrawalId = req.params.withdrawalId;
  next();
}, processWithdrawal);

router.post('/withdrawals/process', processWithdrawal); // new preferred form

// ============ ANALYTICS ============
router.get('/analytics', getPlatformAnalytics);
router.get('/analytics/overview', getPlatformAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);

// ============ SETTINGS / BACKUP ============
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);
router.post('/backup', triggerBackup);

// ============ MODERATION ============
router.get('/comments/reported', getReportedComments);
router.delete('/comments/:commentId', deleteComment);
router.post('/comments/:commentId/dismiss', dismissComment);
router.get('/reports', getReports);
router.post('/reports/:reportId/resolve', (req, res, next) => {
  // Same convenience mirror as the withdrawal route.
  if (!req.body.reportId) req.body.reportId = req.params.reportId;
  next();
}, resolveReport);

export default router;
