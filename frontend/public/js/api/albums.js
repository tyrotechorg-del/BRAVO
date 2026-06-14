

class AlbumsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = (window.API_ENDPOINTS && window.API_ENDPOINTS.ALBUMS) || '/albums';
    }

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
        const { ok, data, status } = await window.authService.api._request(
            `${this.basePath}${path}`,
            options
        );
        if (ok) return { success: true, data, status };
        return { success: false, error: data?.error || 'Request failed', status };
    }

    // Public reads

    async getAll(page = 1, limit = 20, genre = null) {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (genre) params.set('genre', genre);
        const result = await this._publicGet(`?${params.toString()}`);
        return result.success
            ? result.data
            : { albums: [], totalPages: 0, currentPage: 1, total: 0 };
    }

    async getById(id) {
        const result = await this._publicGet(`/${encodeURIComponent(id)}`);
        return result.success ? result.data : null;
    }

    async getTrending() {
        const result = await this._publicGet('/trending');
        return result.success ? result.data : [];
    }

    // Authenticated reads
    // a middleware that rewrites the path to userId='me', then runs
    // through getArtistAlbums. Either of these endpoints works.

    async getMyAlbums() {
        return this._authedRequest('/my/albums', { method: 'GET' });
    }

    async getArtistAlbums(userId) {
        return this._authedRequest(`/artist/${encodeURIComponent(userId)}`, { method: 'GET' });
    }

    // Mutations (artist / admin)

    async create(formData) {
        // FormData uploads go through fetch directly because the
        // _request wrapper assumes JSON. We still want auth + 401
        // refresh, so this method is a thin manual implementation.
        if (!window.authService) {
            return { success: false, error: 'Auth service not available', status: 0 };
        }
        return this._formDataRequest(`${this.basePath}/create`, 'POST', formData);
    }

    async update(id, data) {
        return this._authedRequest(`/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async updateWithCover(id, formData) {
        return this._formDataRequest(`${this.basePath}/${encodeURIComponent(id)}`, 'PUT', formData);
    }

    async delete(id) {
        return this._authedRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }

    async addSong(albumId, songId) {
        return this._authedRequest(`/${encodeURIComponent(albumId)}/add-song`, {
            method: 'POST',
            body: JSON.stringify({ songId })
        });
    }

    async removeSong(albumId, songId) {
        return this._authedRequest(`/${encodeURIComponent(albumId)}/remove-song`, {
            method: 'DELETE',
            body: JSON.stringify({ songId })
        });
    }

    async purchase(id) {
        return this._authedRequest(`/${encodeURIComponent(id)}/purchase`, { method: 'POST' });
    }

    // FormData helper (multipart uploads — bypass JSON wrapper)
    async _formDataRequest(path, method, formData, isRetry = false) {
        const token = window.authService?.getToken?.();
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        // Don't set Content-Type — the browser sets multipart/form-data with boundary.

        try {
            const response = await fetch(`${this.apiUrl}${path}`, {
                method,
                headers,
                body: formData
            });

            const data = await response.json().catch(() => null);

            // 401 retry once via refresh.
            if (response.status === 401 && !isRetry && window.authService) {
                const refreshed = await window.authService.api?._tryRefresh?.();
                if (refreshed) {
                    return this._formDataRequest(path, method, formData, true);
                }
            }

            if (response.ok) {
                return { success: true, data, status: response.status };
            }
            return { success: false, error: data?.error || 'Request failed', status: response.status };
        } catch (err) {
            return { success: false, error: 'Network error', status: 0 };
        }
    }
}

window.AlbumsAPI = AlbumsAPI;
