

class SubscriptionsAPI {
    constructor() {
        this.basePath = window.API_ENDPOINTS?.SUBSCRIPTIONS || '/subscriptions';
    }

    async _request(path, options = {}, requireAuth = true) {
        if (requireAuth) {
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
        // Public endpoint — plain fetch
        try {
            const response = await fetch(`${window.API_BASE_URL}${this.basePath}${path}`, options);
            const data = await response.json();
            if (response.ok) return { success: true, data, status: response.status };
            return {
                success: false,
                error: data?.error || data?.message || 'Request failed',
                status: response.status
            };
        } catch (err) {
            return { success: false, error: err.message || 'Network error', status: 0 };
        }
    }

    // Get all available plans (public endpoint)
    async getPlans() {
        return this._request('/plans', { method: 'GET' }, false);
    }

    // Subscribe to a plan
    async subscribe(planId, paymentMethod, phoneNumber, idempotencyKey = null) {
        const headers = {};
        if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
        return this._request('/subscribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                planId,
                paymentMethod,
                phoneNumber,
                idempotencyKey
            })
        });
    }

    // Get current user's subscription
    async getMySubscription() {
        return this._request('/my-subscription', { method: 'GET' });
    }

    // Cancel current subscription
    async cancelSubscription() {
        return this._request('/cancel', { method: 'POST' });
    }

    // Renew subscription (with optional auto-renew flag)
    async renewSubscription(autoRenew = false) {
        return this._request('/renew', {
            method: 'POST',
            body: JSON.stringify({ autoRenew: !!autoRenew })
        });
    }

    // Subscription payment history
    async getHistory(page = 1, limit = 20) {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        const q = new URLSearchParams({ page: String(safePage), limit: String(safeLimit) }).toString();
        return this._request(`/history?${q}`, { method: 'GET' });
    }
}

window.SubscriptionsAPI = SubscriptionsAPI;
