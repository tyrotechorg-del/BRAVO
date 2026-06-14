

class ArtistsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = (window.API_ENDPOINTS && window.API_ENDPOINTS.ARTISTS) || '/artists';
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
        const { ok, data, status } = await window.authService.api._request(
            `${this.basePath}${path}`,
            options
        );
        if (ok) return { success: true, data, status };
        return { success: false, error: data?.error || 'Request failed', status };
    }

    // Public endpoints

    async getById(artistId) {
        const result = await this._publicGet(`/${encodeURIComponent(artistId)}`);
        // Some callers expect raw artist; keep both shapes accessible.
        // The wrapper returns { success, data }; ArtistProfile checks both.
        return result;
    }

    async getList(page = 1, limit = 20) {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        const result = await this._publicGet(`?${params.toString()}`);
        return result;
    }

    async getTrending() {
        const result = await this._publicGet('/trending');
        return result.success ? result.data : [];
    }

    // Authenticated endpoints (artist-owned)

    async getDashboard() {
        return this._authedRequest('/dashboard', { method: 'GET' });
    }

    async getAnalytics() {
        return this._authedRequest('/analytics', { method: 'GET' });
    }

    async getEarnings() {
        return this._authedRequest('/earnings', { method: 'GET' });
    }

    async updateProfile(data) {
        return this._authedRequest('/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async getMySongs() {
        return this._authedRequest('/songs', { method: 'GET' });
    }

    async getMyAlbums() {
        return this._authedRequest('/albums', { method: 'GET' });
    }

    async requestWithdrawal(amount, method, accountDetails) {
        return this._authedRequest('/withdraw', {
            method: 'POST',
            body: JSON.stringify({ amount, method, accountDetails })
        });
    }

    async getWithdrawals() {
        return this._authedRequest('/withdrawals', { method: 'GET' });
    }

    async purchaseCredits(packageId, paymentMethod = 'wallet', phoneNumber = null) {
        const body = { packageId, paymentMethod };
        if (phoneNumber) body.phoneNumber = phoneNumber;
        return this._authedRequest('/purchase-credits', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    async getSubscription() {
        return this._authedRequest('/subscription', { method: 'GET' });
    }
}

window.ArtistsAPI = ArtistsAPI;
