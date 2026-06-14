

class SongsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = (window.API_ENDPOINTS && window.API_ENDPOINTS.SONGS) || '/songs';
    }

    // Internal helpers

    async _publicGet(path) {
        try {
            const response = await fetch(`${this.apiUrl}${this.basePath}${path}`);
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                return { success: false, error: data?.error || 'Request failed', status: response.status };
            }
            return { success: true, data, status: response.status };
        } catch (err) {
            return { success: false, error: 'Network error', status: 0 };
        }
    }

    async _authedRequest(path, options = {}) {
        if (!window.authService) {
            return { success: false, error: 'Auth service not available', status: 0 };
        }
        // Use AuthAPI's internal _request which has the 401 interceptor.
        const { ok, data, status } = await window.authService.api._request(
            `${this.basePath}${path}`,
            options
        );
        if (ok) return { success: true, data, status };
        return { success: false, error: data?.error || 'Request failed', status };
    }

    // Public endpoints

    async getAll(page = 1, limit = 20, genre = null) {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (genre && genre !== 'all') params.set('genre', genre);
        const result = await this._publicGet(`?${params.toString()}`);
        // Callers want `{ songs, totalPages, currentPage, total }`.
        if (result.success) return result.data;
        return { songs: [], totalPages: 0, currentPage: 1, total: 0 };
    }

    async getById(id) {
        const result = await this._publicGet(`/${encodeURIComponent(id)}`);
        return result.success ? result.data : null;
    }

    async getTrending() {
        const result = await this._publicGet('/trending');
        return result.success ? result.data : [];
    }

    async getFeatured() {
        const result = await this._publicGet('/featured');
        return result.success ? result.data : [];
    }

    async getRecent() {
        const result = await this._publicGet('/recent');
        return result.success ? result.data : [];
    }

    async getByArtist(artistId) {
        const result = await this._publicGet(`/artist/${encodeURIComponent(artistId)}`);
        return result.success ? result.data : [];
    }

    async getByGenre(genre) {
        const result = await this._publicGet(`/genre/${encodeURIComponent(genre)}`);
        return result.success ? result.data : [];
    }

    /**
     * List all videos (songs with isVideo: true).
     * Backend endpoint: GET /api/songs/videos
     */
    async getVideos(page = 1, limit = 20, genre = null) {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        const params = new URLSearchParams({ page: String(safePage), limit: String(safeLimit) });
        if (genre) params.append('genre', genre);
        const result = await this._publicGet(`/videos?${params.toString()}`);
        return result.success ? result.data : null;
    }

    // Authenticated endpoints

    async like(songId) {
        return this._authedRequest(`/${encodeURIComponent(songId)}/like`, { method: 'POST' });
    }

    async unlike(songId) {
        return this._authedRequest(`/${encodeURIComponent(songId)}/like`, { method: 'DELETE' });
    }

    async share(songId, platform = 'copy') {
        return this._authedRequest(`/${encodeURIComponent(songId)}/share`, {
            method: 'POST',
            body: JSON.stringify({ platform })
        });
    }

    async deleteSong(songId) {
        return this._authedRequest(`/${encodeURIComponent(songId)}`, { method: 'DELETE' });
    }
}

window.SongsAPI = SongsAPI;
