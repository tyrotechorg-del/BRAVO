/**
 * Notification Component
 */

class NotificationComponent {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.notifications = [];
        this.apiUrl = window.API_BASE_URL;
        this.init();
    }

    async init() {
        await this.loadNotifications();
        this.render();
    }

    async loadNotifications() {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            this.notifications = [];
            return;
        }
        
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.NOTIFICATIONS}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            this.notifications = data.notifications || [];
        } catch (error) {
            console.error('Load notifications error:', error);
            this.notifications = [];
        }
    }

    render() {
        if (!this.container) return;
        
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        this.container.innerHTML = `
            <div class="notification-panel">
                <div class="notification-header">
                    <h3>Notifications</h3>
                    ${unreadCount > 0 ? `
                        <button class="mark-all-read-btn btn-sm" id="mark-all-read">Mark all as read</button>
                    ` : ''}
                </div>
                <div class="notification-list">
                    ${this.renderNotifications()}
                </div>
            </div>
        `;
        
        this.attachEventListeners();
    }

    renderNotifications() {
        if (this.notifications.length === 0) {
            return '<div class="empty-notifications">No notifications</div>';
        }
        
        return this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification._id}">
                <div class="notification-icon ${notification.type}">
                    <i class="fas ${this.getIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                    <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                    <div class="notification-time">${this.formatTime(notification.createdAt)}</div>
                </div>
                <div class="notification-actions">
                    ${!notification.read ? `
                        <button class="mark-read-btn btn-icon" title="Mark as read">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="delete-notification-btn btn-icon" title="Delete">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    attachEventListeners() {
        const markAllBtn = document.getElementById('mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllAsRead());
        }
        
        document.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = btn.closest('.notification-item');
                const id = item.dataset.id;
                this.markAsRead(id);
            });
        });
        
        document.querySelectorAll('.delete-notification-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = btn.closest('.notification-item');
                const id = item.dataset.id;
                this.deleteNotification(id);
            });
        });
    }

    async markAsRead(id) {
        const token = localStorage.getItem('bravo_token');
        try {
            await fetch(`${this.apiUrl}${window.API_ENDPOINTS.NOTIFICATIONS}/${id}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await this.loadNotifications();
            this.render();
        } catch (error) {
            console.error('Mark as read error:', error);
        }
    }

    async markAllAsRead() {
        const token = localStorage.getItem('bravo_token');
        try {
            await fetch(`${this.apiUrl}${window.API_ENDPOINTS.NOTIFICATIONS}/read-all`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await this.loadNotifications();
            this.render();
        } catch (error) {
            console.error('Mark all as read error:', error);
        }
    }

    async deleteNotification(id) {
        const token = localStorage.getItem('bravo_token');
        try {
            await fetch(`${this.apiUrl}${window.API_ENDPOINTS.NOTIFICATIONS}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await this.loadNotifications();
            this.render();
        } catch (error) {
            console.error('Delete notification error:', error);
        }
    }

    getIcon(type) {
        const icons = {
            like: 'fa-heart',
            comment: 'fa-comment',
            follow: 'fa-user-plus',
            subscription: 'fa-crown',
            withdrawal: 'fa-money-bill-wave',
            admin: 'fa-shield-alt',
            welcome: 'fa-gift',
            artist_update: 'fa-music'
        };
        return icons[type] || 'fa-bell';
    }

    formatTime(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
        return d.toLocaleDateString();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.NotificationComponent = NotificationComponent;