

class SearchAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = (window.API_ENDPOINTS && window.API_ENDPOINTS.SEARCH) || '/search';
    }

    _normalize(query) {
        const q = String(query || '').trim();
        return q.length > 100 ? q.slice(0, 100) : q;
    }

    async _publicGet(path, query, extraParams = {}) {
        const q = this._normalize(query);
        if (q.length < 2) {
            return { success: false, error: 'Type at least 2 characters', status: 0 };
        }

        const params = new URLSearchParams({ q, ...extraParams });
        const url = `${this.apiUrl}${this.basePath}${path}?${params.toString()}`;

        try {
            const response = await fetch(url);
            const data = await response.json().catch(() => null);
            if (response.status === 429) {
                return { success: false, error: 'Too many searches. Please slow down.', status: 429 };
            }
            if (!response.ok) {
                return {
                    success: false,
                    error: data?.error || 'Search failed',
                    status: response.status
                };
            }
            return { success: true, data, status: response.status };
        } catch (err) {
            return { success: false, error: 'Network error', status: 0 };
        }
    }

    // Public methods

    /**
     * Multi-resource search. Returns { songs, artists, albums, playlists }.
     */
    async searchAll(query, limit = 5) {
        return this._publicGet('', query, { limit: String(limit) });
    }

    async searchSongs(query, page = 1, limit = 20) {
        return this._publicGet('/songs', query, {
            page: String(page),
            limit: String(limit)
        });
    }

    async searchArtists(query, page = 1, limit = 20) {
        return this._publicGet('/artists', query, {
            page: String(page),
            limit: String(limit)
        });
    }

    async searchAlbums(query, page = 1, limit = 20) {
        return this._publicGet('/albums', query, {
            page: String(page),
            limit: String(limit)
        });
    }

    async searchPlaylists(query, page = 1, limit = 20) {
        return this._publicGet('/playlists', query, {
            page: String(page),
            limit: String(limit)
        });
    }

    /**
     * Typeahead suggestions. Designed for fast, frequent calls.
     * Backend returns a thin shape: [{ type, _id, label, ... }].
     */
    async getSuggestions(query, limit = 8) {
        return this._publicGet('/suggestions', query, { limit: String(limit) });
    }
}

window.SearchAPI = SearchAPI;
