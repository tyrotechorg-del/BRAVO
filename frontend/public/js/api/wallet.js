

class WalletAPI {
    constructor() {
        this.basePath = window.API_ENDPOINTS?.WALLET || '/wallet';
    }

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

    // Balance
    async getBalance() {
        return this._request('/balance', { method: 'GET' });
    }

    // Transactions
    async getTransactions(page = 1, limit = 20, type = null) {
        // Clamp pagination to match backend bounds
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        return this._request(
            `/transactions${this._buildQuery({ page: safePage, limit: safeLimit, type })}`,
            { method: 'GET' }
        );
    }

    // Deposit (any authenticated user — listeners use this to top
    // up their wallet to buy premium songs/albums)
    async deposit(amount, method, phoneNumber, idempotencyKey = null) {
        const payload = {
            amount: Number(amount),
            method,
            phoneNumber
        };
        const headers = {};
        if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
        return this._request('/deposit', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
    }

    // Withdraw (artist role only — backend enforces; client
    // checks too for a friendlier error)
    async withdraw(amount, method, accountDetails) {
        if (!window.authService?.getUser?.()) {
            return { success: false, error: 'Sign-in required', status: 401 };
        }
        const role = window.authService.getUser().role;
        if (role !== 'artist' && role !== 'admin') {
            return {
                success: false,
                error: 'Only artists can withdraw earnings',
                status: 403
            };
        }
        return this._request('/withdraw', {
            method: 'POST',
            body: JSON.stringify({
                amount: Number(amount),
                method,
                accountDetails
            })
        });
    }

    // Earnings (artist role only — backend enforces)
    async getEarnings() {
        return this._request('/earnings', { method: 'GET' });
    }
}

window.WalletAPI = WalletAPI;
