/**
 * Notifications API Client
 *
 * Backs the NotificationsPage and the Navbar bell-icon badge.
 * Routes through authService for 401-refresh + consistent shape.
 */

class NotificationsAPI {
    constructor() {
        this.basePath = window.API_ENDPOINTS?.NOTIFICATIONS || '/notifications';
    }

    async _request(path, options = {}) {
        if (!window.authService) {
            return { success: false, error: 'Auth service not available', status: 0 };
        }
        const { ok, data, status } = await window.authService.api._request(
            `${this.basePath}${path}`,
            options
        );
        if (ok) return { success: true, data, status };
        return { success: false, error: data?.error || data?.message || 'Request failed', status };
    }

    _query(params) {
        const q = new URLSearchParams();
        Object.entries(params || {}).forEach(([k, v]) => {
            if (v === undefined || v === null || v === '') return;
            q.append(k, String(v));
        });
        const s = q.toString();
        return s ? `?${s}` : '';
    }

    async getAll(page = 1, limit = 20, unreadOnly = false) {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        return this._request(
            `/${this._query({ page: safePage, limit: safeLimit, unreadOnly: unreadOnly || undefined })}`,
            { method: 'GET' }
        );
    }

    async getUnreadCount() {
        return this._request('/unread-count', { method: 'GET' });
    }

    async markAsRead(notificationId) {
        if (!notificationId) return { success: false, error: 'ID required', status: 0 };
        return this._request(`/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
    }

    async markAllAsRead() {
        return this._request('/read-all', { method: 'POST' });
    }

    async delete(notificationId) {
        if (!notificationId) return { success: false, error: 'ID required', status: 0 };
        return this._request(`/${encodeURIComponent(notificationId)}`, { method: 'DELETE' });
    }

    async getSettings() {
        return this._request('/settings', { method: 'GET' });
    }

    async updateSettings(settings) {
        return this._request('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }
}

window.NotificationsAPI = NotificationsAPI;
