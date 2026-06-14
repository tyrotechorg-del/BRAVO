

class AdminAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = '/admin';
    }

    // Internal helpers
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

    _buildQuery(params) {
        const q = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            q.append(key, String(value));
        });
        const str = q.toString();
        return str ? `?${str}` : '';
    }

    // User management
    async getAllUsers(page = 1, limit = 20, role = null, search = null) {
        return this._request(`/users${this._buildQuery({ page, limit, role, search })}`, { method: 'GET' });
    }

    async getUserDetails(userId) {
        if (!userId) return { success: false, error: 'User ID required', status: 0 };
        return this._request(`/users/${encodeURIComponent(userId)}`, { method: 'GET' });
    }

    async updateUserStatus(userId, isActive, role = null) {
        if (!userId) return { success: false, error: 'User ID required', status: 0 };
        const body = { isActive };
        if (role) body.role = role;
        return this._request(`/users/${encodeURIComponent(userId)}/status`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    async deleteUser(userId) {
        if (!userId) return { success: false, error: 'User ID required', status: 0 };
        return this._request(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    }

    // Artist management
    async getAllArtists() {
        return this._request('/artists', { method: 'GET' });
    }

    async getAllArtistsForAdmin(search = '', verified = null) {
        return this._request(`/artists/list${this._buildQuery({ search, verified })}`, { method: 'GET' });
    }

    async verifyArtist(artistId) {
        if (!artistId) return { success: false, error: 'Artist ID required', status: 0 };
        return this._request(`/artists/${encodeURIComponent(artistId)}/verify`, { method: 'POST' });
    }

    async unverifyArtist(artistId) {
        if (!artistId) return { success: false, error: 'Artist ID required', status: 0 };
        return this._request(`/artists/${encodeURIComponent(artistId)}/unverify`, { method: 'POST' });
    }

    async featureArtist(artistId, featured = true) {
        if (!artistId) return { success: false, error: 'Artist ID required', status: 0 };
        return this._request(`/artists/${encodeURIComponent(artistId)}/feature`, {
            method: 'POST',
            body: JSON.stringify({ featured })
        });
    }

    // Song management
    async getAllSongs(page = 1, limit = 50, status = null) {
        return this._request(`/songs${this._buildQuery({ page, limit, status })}`, { method: 'GET' });
    }

    async getAllSongsForAdmin(filters = {}) {
        return this._request(`/songs/all${this._buildQuery(filters)}`, { method: 'GET' });
    }

    async getSongStatistics() {
        return this._request('/songs/statistics', { method: 'GET' });
    }

    async getPendingSongs() {
        return this._request('/songs/pending', { method: 'GET' });
    }

    async approveSong(songId) {
        if (!songId) return { success: false, error: 'Song ID required', status: 0 };
        return this._request(`/songs/${encodeURIComponent(songId)}/approve`, { method: 'POST' });
    }

    async rejectSong(songId, reason) {
        if (!songId) return { success: false, error: 'Song ID required', status: 0 };
        return this._request(`/songs/${encodeURIComponent(songId)}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'Content guidelines violation' })
        });
    }

    async deleteSong(songId) {
        if (!songId) return { success: false, error: 'Song ID required', status: 0 };
        return this._request(`/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' });
    }

    async bulkAction(songIds, action, data = null) {
        if (!Array.isArray(songIds) || songIds.length === 0) {
            return { success: false, error: 'No songs selected', status: 0 };
        }
        if (songIds.length > 500) {
            return { success: false, error: 'Cannot process more than 500 at once', status: 0 };
        }
        return this._request('/songs/bulk-action', {
            method: 'POST',
            body: JSON.stringify({ songIds, action, data })
        });
    }

    // Album management
    async getAllAlbums(page = 1, limit = 50) {
        return this._request(`/albums${this._buildQuery({ page, limit })}`, { method: 'GET' });
    }

    async deleteAlbum(albumId) {
        if (!albumId) return { success: false, error: 'Album ID required', status: 0 };
        return this._request(`/albums/${encodeURIComponent(albumId)}`, { method: 'DELETE' });
    }

    // Video management
    async getAllVideos(page = 1, limit = 50, status = null) {
        // Videos live in the Song collection with isVideo: true. The
        // backend exposes a dedicated admin endpoint for clarity.
        return this._request(`/videos${this._buildQuery({ page, limit, status })}`, { method: 'GET' });
    }

    async approveVideo(videoId) {
        if (!videoId) return { success: false, error: 'Video ID required', status: 0 };
        return this._request(`/videos/${encodeURIComponent(videoId)}/approve`, { method: 'POST' });
    }

    async rejectVideo(videoId, reason) {
        if (!videoId) return { success: false, error: 'Video ID required', status: 0 };
        return this._request(`/videos/${encodeURIComponent(videoId)}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'Content guidelines violation' })
        });
    }

    async deleteVideo(videoId) {
        if (!videoId) return { success: false, error: 'Video ID required', status: 0 };
        return this._request(`/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
    }

    // Analytics
    async getPlatformAnalytics(period = null) {
        return this._request(`/analytics${this._buildQuery({ period })}`, { method: 'GET' });
    }

    async getRevenueAnalytics(period = null) {
        return this._request(`/analytics/revenue${this._buildQuery({ period })}`, { method: 'GET' });
    }

    // Withdrawals
    async getWithdrawals(status = null, page = 1, limit = 50) {
        return this._request(`/withdrawals${this._buildQuery({ status, page, limit })}`, { method: 'GET' });
    }

    async processWithdrawal(withdrawalId, action, transactionReference = null, notes = null) {
        if (!withdrawalId) return { success: false, error: 'Withdrawal ID required', status: 0 };
        const validActions = ['approve', 'reject', 'complete', 'fail'];
        if (!validActions.includes(action)) {
            return { success: false, error: 'Invalid action', status: 0 };
        }
        const body = { action };
        if (transactionReference) body.transactionReference = transactionReference;
        if (notes) body.notes = notes;
        return this._request(`/withdrawals/${encodeURIComponent(withdrawalId)}/process`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // Reports (content reports)
    async getReports(status = null, page = 1, limit = 50) {
        return this._request(`/reports${this._buildQuery({ status, page, limit })}`, { method: 'GET' });
    }

    async resolveReport(reportId, action, adminNotes = '') {
        if (!reportId) return { success: false, error: 'Report ID required', status: 0 };
        return this._request(`/reports/${encodeURIComponent(reportId)}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ action, adminNotes })
        });
    }

    async dismissReport(reportId, adminNotes = '') {
        return this.resolveReport(reportId, 'dismiss', adminNotes);
    }

    // Reported comments
    async getReportedComments(page = 1, limit = 50) {
        return this._request(`/comments/reported${this._buildQuery({ page, limit })}`, { method: 'GET' });
    }

    async deleteComment(commentId) {
        if (!commentId) return { success: false, error: 'Comment ID required', status: 0 };
        return this._request(`/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
    }

    async dismissCommentReport(commentId) {
        if (!commentId) return { success: false, error: 'Comment ID required', status: 0 };
        return this._request(`/comments/${encodeURIComponent(commentId)}/dismiss`, { method: 'POST' });
    }

    async getSystemSettings() {
        return this._request('/settings', { method: 'GET' });
    }

    async updateSystemSettings(settings) {
        return this._request('/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    // Backup
    async triggerBackup() {
        return this._request('/backup', { method: 'POST' });
    }

    // Admin uploads (multipart)
    async adminUploadSong(formData) {
        return this._request('/upload-song', {
            method: 'POST',
            body: formData
            // No Content-Type — browser sets multipart/form-data with boundary
        });
    }

    async adminUploadVideo(formData) {
        return this._request('/upload-video', {
            method: 'POST',
            body: formData
        });
    }

    async adminUploadAlbum(formData) {
        return this._request('/upload-album', {
            method: 'POST',
            body: formData
        });
    }
}

window.AdminAPI = AdminAPI;
