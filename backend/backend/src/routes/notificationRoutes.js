import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  updateNotificationSettings,
} from '../controllers/notificationController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);

// Original used POST for these; the controller uses PATCH semantically.
// Kept POST endpoints for backwards compatibility, also expose PATCH
// (the proper REST verb) so the frontend can migrate at its own pace.
router.post('/:id/read', auth, markAsRead);
router.patch('/:id/read', auth, markAsRead);

router.post('/read-all', auth, markAllAsRead);
router.patch('/read-all', auth, markAllAsRead);

router.delete('/:id', auth, deleteNotification);

router.post('/settings', auth, updateNotificationSettings);
router.put('/settings', auth, updateNotificationSettings); // proper verb

export default router;
