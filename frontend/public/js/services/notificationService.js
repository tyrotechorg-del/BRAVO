/**
 * Notification Service
 */

class NotificationService {
    constructor() {
        this.permission = false;
        this.registration = null;
        this.init();
    }

    async init() {
        if ('Notification' in window) {
            this.permission = Notification.permission === 'granted';
            
            if ('serviceWorker' in navigator) {
                this.registration = await navigator.serviceWorker.ready;
            }
        }
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return false;
        }
        
        const permission = await Notification.requestPermission();
        this.permission = permission === 'granted';
        return this.permission;
    }

    showNotification(title, options = {}) {
        if (!this.permission) return;
        
        const defaultOptions = {
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/badge-72x72.png',
            vibrate: [200, 100, 200],
            silent: false
        };
        
        const notificationOptions = { ...defaultOptions, ...options };
        
        if (this.registration) {
            this.registration.showNotification(title, notificationOptions);
        } else if (Notification.permission === 'granted') {
            new Notification(title, notificationOptions);
        }
    }

    notifyNewFollower(username) {
        this.showNotification('New Follower', {
            body: `${username} started following you!`,
            tag: 'follower',
            data: { type: 'follower', username }
        });
    }

    notifyNewComment(username, songTitle) {
        this.showNotification('New Comment', {
            body: `${username} commented on "${songTitle}"`,
            tag: 'comment',
            data: { type: 'comment', username, songTitle }
        });
    }

    notifySongApproved(songTitle) {
        this.showNotification('Song Approved', {
            body: `Your song "${songTitle}" has been approved!`,
            tag: 'approval',
            data: { type: 'approval', songTitle }
        });
    }

    notifyWithdrawalProcessed(amount, status) {
        const body = status === 'approved' 
            ? `Your withdrawal of K${amount} has been processed.`
            : `Your withdrawal of K${amount} has been rejected.`;
            
        this.showNotification('Withdrawal Update', { body, tag: 'withdrawal' });
    }
}

window.NotificationService = NotificationService;