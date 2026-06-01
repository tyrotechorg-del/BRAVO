/**
 * Admin API Client - Complete Working Version with All Data Endpoints
 */

class AdminAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.getToken()}`,
            'Content-Type': 'application/json'
        };
    }

    async request(url, options = {}) {
        try {
            const response = await fetch(`${this.apiUrl}${url}`, {
                ...options,
                headers: {
                    ...this.getHeaders(),
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error (${url}):`, error);
            return { error: error.message };
        }
    }

    // ============ USER MANAGEMENT ============
    async getAllUsers(page = 1, limit = 20, role = null, search = null) {
        let url = `/admin/users?page=${page}&limit=${limit}`;
        if (role && role !== '') url += `&role=${role}`;
        if (search && search !== '') url += `&search=${encodeURIComponent(search)}`;
        return this.request(url);
    }

    async getUserDetails(userId) {
        if (!userId) return { error: 'User ID required' };
        return this.request(`/admin/users/${userId}`);
    }

    async updateUserStatus(userId, isActive, role = null) {
        if (!userId) return { error: 'User ID required' };
        const body = { isActive };
        if (role) body.role = role;
        return this.request(`/admin/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    async deleteUser(userId) {
        if (!userId) return { error: 'User ID required' };
        return this.request(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
    }

    // ============ ARTIST MANAGEMENT ============
    async getAllArtists() {
        return this.request('/admin/artists');
    }

    async getAllArtistsForAdmin(search = '', verified = null) {
        let url = '/admin/artists/list';
        const params = [];
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (verified !== null) params.push(`verified=${verified}`);
        if (params.length) url += `?${params.join('&')}`;
        return this.request(url);
    }

    async verifyArtist(artistId) {
        if (!artistId) return { error: 'Artist ID required' };
        return this.request(`/admin/artists/${artistId}/verify`, {
            method: 'POST'
        });
    }

    async featureArtist(artistId) {
        if (!artistId) return { error: 'Artist ID required' };
        return this.request(`/admin/artists/${artistId}/feature`, {
            method: 'POST'
        });
    }

    // ============ SONG MANAGEMENT ============
    async getAllSongs(page = 1, limit = 50, status = null) {
        let url = `/admin/songs?page=${page}&limit=${limit}`;
        if (status && status !== '') url += `&status=${status}`;
        return this.request(url);
    }

    async getAllSongsForAdmin(filters = {}) {
        let url = '/admin/songs/all?';
        const params = [];
        if (filters.page) params.push(`page=${filters.page}`);
        if (filters.limit) params.push(`limit=${filters.limit}`);
        if (filters.status) params.push(`status=${filters.status}`);
        if (filters.genre) params.push(`genre=${filters.genre}`);
        if (filters.artistId) params.push(`artistId=${filters.artistId}`);
        if (filters.search) params.push(`search=${encodeURIComponent(filters.search)}`);
        if (filters.isVideo !== undefined) params.push(`isVideo=${filters.isVideo}`);
        if (filters.sortBy) params.push(`sortBy=${filters.sortBy}`);
        if (filters.sortOrder) params.push(`sortOrder=${filters.sortOrder}`);
        url += params.join('&');
        return this.request(url);
    }

    async getSongStatistics() {
        return this.request('/admin/songs/statistics');
    }

    async getPendingSongs() {
        return this.request('/admin/songs/pending');
    }

    async approveSong(songId) {
        if (!songId) return { error: 'Song ID required' };
        return this.request(`/admin/songs/${songId}/approve`, {
            method: 'POST'
        });
    }

    async rejectSong(songId, reason) {
        if (!songId) return { error: 'Song ID required' };
        return this.request(`/admin/songs/${songId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'Content guidelines violation' })
        });
    }

    async deleteSong(songId) {
        if (!songId) return { error: 'Song ID required' };
        return this.request(`/admin/songs/${songId}`, {
            method: 'DELETE'
        });
    }

    async bulkAction(songIds, action, data = null) {
        if (!songIds || !songIds.length) return { error: 'No songs selected' };
        return this.request('/admin/songs/bulk-action', {
            method: 'POST',
            body: JSON.stringify({ songIds, action, data })
        });
    }

    // ============ ALBUM MANAGEMENT ============
    async getAllAlbums() {
        return this.request('/admin/albums');
    }

    async deleteAlbum(albumId) {
        if (!albumId) return { error: 'Album ID required' };
        return this.request(`/admin/albums/${albumId}`, {
            method: 'DELETE'
        });
    }

    // ============ ANALYTICS ============
    async getPlatformAnalytics() {
        return this.request('/admin/analytics');
    }

    async getRevenueAnalytics() {
        return this.request('/admin/analytics/revenue');
    }

    // ============ WITHDRAWALS ============
    async getWithdrawals(status = null) {
        let url = '/admin/withdrawals';
        if (status && status !== '') url += `?status=${status}`;
        return this.request(url);
    }

    async processWithdrawal(withdrawalId, action, transactionReference = null) {
        if (!withdrawalId) return { error: 'Withdrawal ID required' };
        const body = { action };
        if (transactionReference) body.transactionReference = transactionReference;
        return this.request(`/admin/withdrawals/${withdrawalId}/process`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // ============ REPORTS ============
    async getReports() {
        return this.request('/admin/reports');
    }

    async resolveReport(reportId, action, adminNotes) {
        if (!reportId) return { error: 'Report ID required' };
        return this.request(`/admin/reports/${reportId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ action, adminNotes: adminNotes || '' })
        });
    }

    // ============ SETTINGS ============
    async getSystemSettings() {
        return this.request('/admin/settings');
    }

    async updateSystemSettings(settings) {
        return this.request('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    // ============ BACKUP ============
    async triggerBackup() {
        return this.request('/admin/backup', {
            method: 'POST'
        });
    }

    // ============ REPORTED COMMENTS ============
    async getReportedComments() {
        return this.request('/admin/comments/reported');
    }

    async deleteComment(commentId) {
        if (!commentId) return { error: 'Comment ID required' };
        return this.request(`/admin/comments/${commentId}`, {
            method: 'DELETE'
        });
    }

    // ============ ADMIN UPLOADS ============
    async adminUploadSong(formData) {
        const token = this.getToken();
        const response = await fetch(`${this.apiUrl}/admin/upload-song`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        return response.json();
    }

    async adminUploadVideo(formData) {
        const token = this.getToken();
        const response = await fetch(`${this.apiUrl}/admin/upload-video`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        return response.json();
    }

    async adminUploadAlbum(formData) {
        const token = this.getToken();
        const response = await fetch(`${this.apiUrl}/admin/upload-album`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        return response.json();
    }
}

window.AdminAPI = AdminAPI;