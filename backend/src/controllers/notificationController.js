import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        
        const query = { user: req.user._id };
        if (unreadOnly === 'true') query.read = false;
        
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
        
        res.json({
            notifications,
            unreadCount,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ user: req.user._id, read: false });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        
        const notification = await Notification.findOneAndUpdate(
            { _id: id, user: req.user._id },
            { read: true, readAt: new Date() },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        res.json({ message: 'Marked as read', notification });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, read: false },
            { read: true, readAt: new Date() }
        );
        
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        
        const notification = await Notification.findOneAndDelete({
            _id: id,
            user: req.user._id
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

export const updateNotificationSettings = async (req, res) => {
    try {
        const { email, push, comments, followers, subscriptions } = req.body;
        
        const user = await User.findById(req.user._id);
        user.preferences.notifications = {
            email: email !== undefined ? email : user.preferences.notifications.email,
            push: push !== undefined ? push : user.preferences.notifications.push,
            comments: comments !== undefined ? comments : user.preferences.notifications.comments,
            followers: followers !== undefined ? followers : user.preferences.notifications.followers,
            subscriptions: subscriptions !== undefined ? subscriptions : user.preferences.notifications.subscriptions
        };
        
        await user.save();
        
        res.json({ message: 'Notification settings updated', settings: user.preferences.notifications });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
};