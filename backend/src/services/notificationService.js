import Notification from '../models/Notification.js';
import { getIO } from '../config/socket.js';

class NotificationService {
    async createNotification(userId, type, title, message, data = {}) {
        try {
            const notification = new Notification({
                user: userId,
                type,
                title,
                message,
                data,
                read: false,
                createdAt: new Date()
            });
            
            await notification.save();
            
            try {
                const io = getIO();
                io.to(`user:${userId}`).emit('notification', notification);
            } catch (socketError) {
                console.log('Socket not initialized, notification saved only');
            }
            
            return notification;
        } catch (error) {
            console.error('Create notification error:', error);
            return null;
        }
    }

    async notifyAdmins(title, message, data = {}) {
        const User = await import('../models/User.js');
        const admins = await User.default.find({ role: 'admin', isActive: true });
        
        for (const admin of admins) {
            await this.createNotification(
                admin._id,
                'admin',
                title,
                message,
                data
            );
        }
    }

    async notifyFollowers(artistId, title, message, data = {}) {
        const User = await import('../models/User.js');
        const followers = await User.default.find({ following: artistId });
        
        for (const follower of followers) {
            await this.createNotification(
                follower._id,
                'artist_update',
                title,
                message,
                data
            );
        }
    }

    async notifySongUpload(artist, song) {
        await this.notifyFollowers(
            artist.userId,
            'New Music Upload',
            `${artist.stageName} just released a new song: ${song.title}`,
            { songId: song._id, type: 'new_song' }
        );
    }

    async notifySubscriptionExpiry(userId, daysLeft) {
        await this.createNotification(
            userId,
            'subscription',
            'Subscription Expiring Soon',
            `Your subscription will expire in ${daysLeft} days. Renew now to continue enjoying benefits.`,
            { daysLeft, type: 'expiry_warning' }
        );
    }
}

export default new NotificationService();