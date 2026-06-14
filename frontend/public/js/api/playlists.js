

class PlaylistsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = (window.API_ENDPOINTS && window.API_ENDPOINTS.PLAYLISTS) || '/playlists';
    }

    async _publicGet(path) {
        try {
            // Attach token if available — backend uses optionalAuth.
            const token = window.authService?.getToken?.() || localStorage.getItem('bravo_token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await fetch(`${this.apiUrl}${this.basePath}${path}`, { headers });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                return { success: false, error: data?.error || 'Request failed', status: response.status };
            }
            return { success: true, data, status: response.status };
        } catch {
            return { success: false, error: 'Network error', status: 0 };
        }
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

    // Public

    async getById(playlistId) {
        return this._publicGet(`/${encodeURIComponent(playlistId)}`);
    }

    async getPublic(page = 1, limit = 20) {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        return this._publicGet(`/public?${params.toString()}`);
    }

    // Authenticated

    async create(data) {
        return this._authedRequest('/create', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async update(playlistId, data) {
        return this._authedRequest(`/${encodeURIComponent(playlistId)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(playlistId) {
        return this._authedRequest(`/${encodeURIComponent(playlistId)}`, {
            method: 'DELETE'
        });
    }

    async getUserPlaylists() {
        return this._authedRequest('', { method: 'GET' });
    }

    async addSong(playlistId, songId) {
        return this._authedRequest(`/${encodeURIComponent(playlistId)}/songs`, {
            method: 'POST',
            body: JSON.stringify({ songId })
        });
    }

    async removeSong(playlistId, songId) {
        return this._authedRequest(
            `/${encodeURIComponent(playlistId)}/songs/${encodeURIComponent(songId)}`,
            { method: 'DELETE' }
        );
    }

    async reorderSongs(playlistId, songIds) {
        return this._authedRequest(`/${encodeURIComponent(playlistId)}/reorder`, {
            method: 'PUT',
            body: JSON.stringify({ songIds })
        });
    }
}

window.PlaylistsAPI = PlaylistsAPI;
