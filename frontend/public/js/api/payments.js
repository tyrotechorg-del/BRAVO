

class PaymentsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.basePath = window.API_ENDPOINTS?.PAYMENTS || '/payments';
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

    /**
     * Generate a cryptographically random idempotency key.
     * Format: 'idem_' + 32 hex chars from crypto.getRandomValues.
     */
    _generateIdempotencyKey() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return `idem_${hex}`;
    }

    // Initiate payment (mobile money or wallet)
    async initiatePayment(amount, type, method, phoneNumber, metadata = {}, idempotencyKey = null) {
        const key = idempotencyKey || this._generateIdempotencyKey();
        return this._request('/initiate', {
            method: 'POST',
            headers: { 'Idempotency-Key': key },
            body: JSON.stringify({
                amount: Number(amount),
                type,
                method,
                phoneNumber,
                metadata,
                idempotencyKey: key   // also send in body so the backend can dedupe via either path
            })
        });
    }

    // Get payment status (used by polling helper below)
    async getPaymentStatus(reference) {
        if (!reference) {
            return { success: false, error: 'Reference required', status: 0 };
        }
        return this._request(
            `/status/${encodeURIComponent(reference)}`,
            { method: 'GET' }
        );
    }

    /**
     * Poll payment status until it reaches a terminal state.
     *
     * @param {string} reference - The payment reference returned by initiatePayment.
     * @param {object} opts
     *   - {function} onUpdate(status) - Called on each successful poll
     *   - {number} timeoutMs - Total time budget (default 90s — mobile money flows usually settle in 30–60s)
     *   - {number} initialIntervalMs - First poll delay (default 2s)
     *   - {number} maxIntervalMs - Cap on backoff (default 8s)
     *   - {AbortSignal} signal - Abort the poll early
     *
     * @returns {Promise<{ success, data?, error?, status?, terminal: 'completed' | 'failed' | 'cancelled' | 'timeout' }>}
     */
    async pollStatus(reference, opts = {}) {
        const onUpdate = typeof opts.onUpdate === 'function' ? opts.onUpdate : () => {};
        const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 90_000;
        let intervalMs = Number.isFinite(opts.initialIntervalMs) ? opts.initialIntervalMs : 2_000;
        const maxIntervalMs = Number.isFinite(opts.maxIntervalMs) ? opts.maxIntervalMs : 8_000;
        const signal = opts.signal;
        const startedAt = Date.now();
        const terminalStates = new Set(['completed', 'failed', 'cancelled', 'refunded']);

        while (Date.now() - startedAt < timeoutMs) {
            if (signal?.aborted) {
                return { success: false, error: 'Cancelled', terminal: 'cancelled' };
            }
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            if (signal?.aborted) {
                return { success: false, error: 'Cancelled', terminal: 'cancelled' };
            }

            const result = await this.getPaymentStatus(reference);
            if (!result.success) {
                // Transient errors — keep polling. Hard 4xx errors are terminal.
                if (result.status >= 400 && result.status < 500) {
                    return { ...result, terminal: 'failed' };
                }
                // Network/5xx: continue polling with backoff
            } else {
                const status = result.data?.payment?.status || result.data?.status;
                try { onUpdate(status, result.data); } catch {}
                if (status && terminalStates.has(status)) {
                    return { ...result, terminal: status };
                }
            }

            // Exponential backoff
            intervalMs = Math.min(intervalMs * 1.5, maxIntervalMs);
        }

        return { success: false, error: 'Payment confirmation timed out', terminal: 'timeout' };
    }

    // History
    async getHistory(page = 1, limit = 20, type = null) {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        return this._request(
            `/history${this._buildQuery({ page: safePage, limit: safeLimit, type })}`,
            { method: 'GET' }
        );
    }

    // Methods (public — no auth required)
    async getMethods() {
        // This is a public endpoint; route through plain fetch.
        try {
            const response = await fetch(`${this.apiUrl}${this.basePath}/methods`);
            const data = await response.json();
            if (response.ok) return { success: true, data, status: response.status };
            return {
                success: false,
                error: data?.error || data?.message || 'Failed to fetch methods',
                status: response.status
            };
        } catch (err) {
            return { success: false, error: err.message || 'Network error', status: 0 };
        }
    }

    // Refund
    async refund(paymentId, reason = null) {
        if (!paymentId) {
            return { success: false, error: 'Payment ID required', status: 0 };
        }
        return this._request(
            `/refund/${encodeURIComponent(paymentId)}`,
            {
                method: 'POST',
                body: reason ? JSON.stringify({ reason }) : undefined
            }
        );
    }
}

window.PaymentsAPI = PaymentsAPI;
