import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// GET /api/notifications                 (auth required)
// ============================================================
export const getNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { unreadOnly } = req.query;

    const query = { user: req.user._id };
    // Accept both "true" string (URL query) and boolean true.
    if (unreadOnly === 'true' || unreadOnly === true) {
      query.read = false;
    }

    // Run all three queries in parallel — was sequential.
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);

    res.json({
      notifications,
      unreadCount,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// ============================================================
// GET /api/notifications/unread-count    (auth required)
// ============================================================
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

// ============================================================
// PATCH /api/notifications/:id/read      (auth required)
// ============================================================
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id }, // ownership check is in the filter
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      // Could be: notification doesn't exist OR belongs to another user.
      // 404 for both — don't leak existence.
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Marked as read', notification });
  } catch (err) {
    console.error('markAsRead error:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

// ============================================================
// PATCH /api/notifications/read-all      (auth required)
// ============================================================
export const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

// ============================================================
// DELETE /api/notifications/:id          (auth required)
// ============================================================
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('deleteNotification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

// ============================================================
// PUT /api/notifications/settings        (auth required)
// ============================================================
//
// FIX: The original code did:
//   user.preferences.notifications = { email: ..., push: ..., ... }
// which crashes if `user.preferences` or `user.preferences.notifications`
// is undefined (newer/migrated user docs may have either missing).
//
// FIX: Whitelist the fields explicitly so arbitrary user input doesn't
// stomp other preference fields.
//
export const updateNotificationSettings = async (req, res) => {
  try {
    const { email, push, comments, followers, subscriptions } = req.body;

    // Build the update map using $set with dot-paths. This avoids the
    // "preferences is undefined" crash entirely — Mongo creates the
    // nested path as needed.
    const updates = {};
    if (email !== undefined)        updates['preferences.notifications.email']         = Boolean(email);
    if (push !== undefined)         updates['preferences.notifications.push']          = Boolean(push);
    if (comments !== undefined)     updates['preferences.notifications.comments']      = Boolean(comments);
    if (followers !== undefined)    updates['preferences.notifications.followers']     = Boolean(followers);
    if (subscriptions !== undefined) updates['preferences.notifications.subscriptions'] = Boolean(subscriptions);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Notification settings updated',
      settings: user.preferences?.notifications || {},
    });
  } catch (err) {
    console.error('updateNotificationSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};
