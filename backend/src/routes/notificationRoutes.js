import express from 'express';
import { 
  getNotifications, getUnreadCount, markAsRead, 
  markAllAsRead, deleteNotification, updateNotificationSettings
} from '../controllers/notificationController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.post('/:id/read', auth, markAsRead);
router.post('/read-all', auth, markAllAsRead);
router.delete('/:id', auth, deleteNotification);
router.post('/settings', auth, updateNotificationSettings);

export default router;