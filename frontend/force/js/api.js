// API Helper Functions
class API {
    static getToken() {
        return localStorage.getItem('bravo_token');
    }

    static setToken(token) {
        localStorage.setItem('bravo_token', token);
    }

    static setUser(user) {
        localStorage.setItem('bravo_user', JSON.stringify(user));
    }

    static getUser() {
        const user = localStorage.getItem('bravo_user');
        return user ? JSON.parse(user) : null;
    }

    static async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };

        const response = await fetch(`${window.APP_CONFIG.API_URL}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Request failed');
        }
        return data;
    }

    static getFullUrl(path) {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        if (path.startsWith('/uploads')) return `http://localhost:5000${path}`;
        return path;
    }
}

// Auth API
class AuthAPI {
    static async login(email, password) {
        const data = await API.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (data.token) API.setToken(data.token);
        if (data.user) API.setUser(data.user);
        return data;
    }

    static async register(userData) {
        const data = await API.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        if (data.token) API.setToken(data.token);
        if (data.user) API.setUser(data.user);
        return data;
    }

    static async logout() {
        await API.request('/auth/logout', { method: 'POST' });
        localStorage.removeItem('bravo_token');
        localStorage.removeItem('bravo_user');
    }

    static isAuthenticated() {
        return !!API.getToken();
    }

    static isAdmin() {
        const user = API.getUser();
        return user && user.role === 'admin';
    }

    static isArtist() {
        const user = API.getUser();
        return user && user.role === 'artist';
    }
}

// Songs API
class SongsAPI {
    static async getAll(page = 1, limit = 20, genre = null) {
        let url = `/songs?page=${page}&limit=${limit}`;
        if (genre && genre !== 'all') url += `&genre=${encodeURIComponent(genre)}`;
        const data = await API.request(url);
        return data;
    }

    static async getTrending() {
        const data = await API.request('/songs/trending');
        return data;
    }

    static async getFeatured() {
        const data = await API.request('/songs/featured');
        return data;
    }

    static async getTopArtists() {
        const data = await API.request('/analytics/top-artists');
        return data;
    }

    static async like(songId) {
        return await API.request(`/songs/${songId}/like`, { method: 'POST' });
    }

    static async unlike(songId) {
        return await API.request(`/songs/${songId}/like`, { method: 'DELETE' });
    }
}

// Admin API
class AdminAPI {
    static async getPlatformAnalytics() {
        return await API.request('/admin/analytics');
    }

    static async getPendingSongs() {
        return await API.request('/admin/songs/pending');
    }

    static async approveSong(songId) {
        return await API.request(`/admin/songs/${songId}/approve`, { method: 'POST' });
    }

    static async rejectSong(songId, reason) {
        return await API.request(`/admin/songs/${songId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    }

    static async getAllUsers(page = 1, limit = 20, role = null, search = null) {
        let url = `/admin/users?page=${page}&limit=${limit}`;
        if (role) url += `&role=${role}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        return await API.request(url);
    }

    static async updateUserStatus(userId, isActive, role = null) {
        return await API.request(`/admin/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ isActive, role })
        });
    }

    static async deleteUser(userId) {
        return await API.request(`/admin/users/${userId}`, { method: 'DELETE' });
    }

    static async getWithdrawals(status = null) {
        let url = '/admin/withdrawals';
        if (status) url += `?status=${status}`;
        return await API.request(url);
    }

    static async processWithdrawal(withdrawalId, action, reference = null) {
        return await API.request(`/admin/withdrawals/${withdrawalId}/process`, {
            method: 'POST',
            body: JSON.stringify({ action, transactionReference: reference })
        });
    }

    static async getReports() {
        return await API.request('/admin/reports');
    }

    static async resolveReport(reportId, action, notes) {
        return await API.request(`/admin/reports/${reportId}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ action, adminNotes: notes })
        });
    }

    static async getReportedComments() {
        return await API.request('/admin/comments/reported');
    }

    static async deleteComment(commentId) {
        return await API.request(`/admin/comments/${commentId}`, { method: 'DELETE' });
    }

    static async verifyArtist(artistId) {
        return await API.request(`/admin/artists/${artistId}/verify`, { method: 'POST' });
    }

    static async featureArtist(artistId) {
        return await API.request(`/admin/artists/${artistId}/feature`, { method: 'POST' });
    }

    static async getSystemSettings() {
        return await API.request('/admin/settings');
    }

    static async updateSystemSettings(settings) {
        return await API.request('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    static async triggerBackup() {
        return await API.request('/admin/backup', { method: 'POST' });
    }

    static async uploadSong(formData) {
        const token = API.getToken();
        const response = await fetch(`${window.APP_CONFIG.API_URL}/admin/upload-song`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        return await response.json();
    }
}

// Export to window
window.API = API;
window.AuthAPI = AuthAPI;
window.SongsAPI = SongsAPI;
window.AdminAPI = AdminAPI;