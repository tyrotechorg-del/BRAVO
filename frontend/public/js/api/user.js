

class UserAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = (window.API_ENDPOINTS && window.API_ENDPOINTS.USERS) || '/users';
    }

    async _authedRequest(path, options = {}) {
        if (!window.authService) {
            return { success: false, error: 'Auth service not available', status: 0 };
        }
        const { ok, data, status } = await window.authService.api._request(
            `${this.basePath}${path}`,
            options
        );
        if (ok) return { success: true, data, status };
        return { success: false, error: data?.error || 'Request failed', status };
    }

    async _publicGet(path) {
        try {
            const response = await fetch(`${this.apiUrl}${this.basePath}${path}`);
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                return { success: false, error: data?.error || 'Request failed', status: response.status };
            }
            return { success: true, data, status: response.status };
        } catch {
            return { success: false, error: 'Network error', status: 0 };
        }
    }

    // Profile

    async getProfile() {
        return this._authedRequest('/profile', { method: 'GET' });
    }

    async getPublicProfile(userId) {
        return this._publicGet(`/${encodeURIComponent(userId)}`);
    }

    async updateProfile(data) {
        return this._authedRequest('/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * Upload a new avatar. We must NOT set Content-Type — the browser
     * sets multipart/form-data with the right boundary automatically.
     * The internal _request wrapper sets Content-Type to application/json
     * only when the body is a string, so FormData passes through correctly.
     */
    async updateAvatar(file) {
        const formData = new FormData();
        formData.append('avatar', file);
        return this._authedRequest('/profile/avatar', {
            method: 'POST',
            body: formData
        });
    }

    async deleteAccount(password) {
        return this._authedRequest('/account', {
            method: 'DELETE',
            body: JSON.stringify({ password })
        });
    }

    // Social

    async getFollowers() {
        return this._authedRequest('/followers', { method: 'GET' });
    }

    async getFollowing() {
        return this._authedRequest('/following', { method: 'GET' });
    }

    async followUser(userId) {
        return this._authedRequest(`/follow/${encodeURIComponent(userId)}`, { method: 'POST' });
    }

    async unfollowUser(userId) {
        return this._authedRequest(`/unfollow/${encodeURIComponent(userId)}`, { method: 'POST' });
    }

    // Library (liked songs, history, etc — backend exposes these)

    async getLikedSongs() {
        return this._authedRequest('/me/liked', { method: 'GET' });
    }

    async getListenHistory() {
        return this._authedRequest('/me/history', { method: 'GET' });
    }

    async getNotificationSettings() {
        return this._authedRequest('/notifications/settings', { method: 'GET' });
    }

    async updateNotificationSettings(settings) {
        return this._authedRequest('/notifications/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    /**
     * Update user preferences (theme, language, notification flags).
     * Wraps updateProfile with the preferences nested object — the
     * backend stores all preferences under user.preferences.
     */
    async updatePreferences(preferences) {
        return this._authedRequest('/profile', {
            method: 'PUT',
            body: JSON.stringify({ preferences })
        });
    }

    /**
     * Upgrade the current listener account to an artist account.
     * Creates an Artist record and updates user.role.
     * Backend endpoint: POST /api/users/me/upgrade-to-artist
     * (added by batch-16-extras/_userController.upgradeToArtist.patch.js)
     */
    async upgradeToArtist(data) {
        return this._authedRequest('/me/upgrade-to-artist', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
}

window.UserAPI = UserAPI;
