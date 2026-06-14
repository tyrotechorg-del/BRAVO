

class AuthAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
        this.authPath = (window.API_ENDPOINTS && window.API_ENDPOINTS.AUTH) || '/auth';
        this.usersPath = (window.API_ENDPOINTS && window.API_ENDPOINTS.USERS) || '/users';

        // In-flight refresh promise. If two API calls 401 simultaneously,
        // both should wait on the same refresh attempt rather than
        // racing to refresh (which would invalidate each other's tokens).
        this._refreshInFlight = null;
    }

    // Storage helpers
    // These read/write directly to localStorage with the `bravo_` prefix.
    // window.authService (in services/authService.js) wraps these with
    // additional logic (event emission, etc). Direct callers still work.

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    setToken(token) {
        if (token) localStorage.setItem('bravo_token', token);
        else localStorage.removeItem('bravo_token');
    }

    getRefreshToken() {
        return localStorage.getItem('bravo_refresh_token');
    }

    setRefreshToken(token) {
        if (token) localStorage.setItem('bravo_refresh_token', token);
        else localStorage.removeItem('bravo_refresh_token');
    }

    setUser(user) {
        if (user) localStorage.setItem('bravo_user', JSON.stringify(user));
        else localStorage.removeItem('bravo_user');
    }

    getUser() {

        try {
            const raw = localStorage.getItem('bravo_user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('Corrupted user in localStorage — clearing');
            localStorage.removeItem('bravo_user');
            return null;
        }
    }

    clearStorage() {
        localStorage.removeItem('bravo_token');
        localStorage.removeItem('bravo_refresh_token');
        localStorage.removeItem('bravo_user');
    }

    // Token decode + expiry check

    // now also check the JWT's `exp` claim. If the token's malformed
    // we treat it as not-authenticated and clear it.
    _decodeToken(token) {
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
            return decoded;
        } catch {
            return null;
        }
    }

    isTokenExpired() {
        const token = this.getToken();
        if (!token) return true;
        const decoded = this._decodeToken(token);
        if (!decoded || !decoded.exp) return true;
        // exp is in seconds since epoch. Treat tokens within 10s of
        // expiry as already expired to avoid race with server clock.
        return decoded.exp * 1000 < Date.now() + 10_000;
    }

    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;
        // We allow expired tokens here because the request() method
        // will auto-refresh on 401. The "is the user logged in" answer
        // is "do they have any token + a refresh token". For strict
        // checks use `isTokenExpired()`.
        return true;
    }

    isAdmin() {
        const user = this.getUser();
        return Boolean(user && user.role === 'admin');
    }

    isArtist() {
        const user = this.getUser();
        return Boolean(user && user.role === 'artist');
    }

    isEmailVerified() {
        const user = this.getUser();
        return Boolean(user && user.isVerified === true);
    }

    // Internal fetch wrapper with 401-refresh interceptor
    //
    // Any call going through this wrapper gets:
    //   - Authorization header attached if a token is present
    //   - Content-Type application/json if a body is provided
    //   - JSON parsing of the response body (tolerant of empty bodies)
    //   - On a 401: try to refresh the token, then replay the request
    //     ONCE. If refresh also fails, clear storage and surface 401.
    //
    // The retry-once strategy prevents infinite loops if the refresh
    // succeeds but the new token also gets rejected (in which case
    // something is seriously wrong server-side and we want to log out).

    async _request(path, options = {}, isRetry = false) {
        const url = `${this.apiUrl}${path}`;
        const headers = { ...(options.headers || {}) };

        const token = this.getToken();
        if (token && !headers.Authorization) {
            headers.Authorization = `Bearer ${token}`;
        }

        if (options.body && !headers['Content-Type'] && typeof options.body === 'string') {
            headers['Content-Type'] = 'application/json';
        }

        let response;
        try {
            response = await fetch(url, { ...options, headers });
        } catch (err) {
            // Network error / DNS / offline.
            return { ok: false, status: 0, data: { error: 'Network error. Please check your connection.' } };
        }

        let data = null;
        const text = await response.text();
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { error: 'Invalid server response' };
            }
        } else {
            data = {};
        }

        // Skip refresh logic if this IS the refresh call, or if we've
        // already retried.
        if (response.status === 401 && !isRetry && path !== `${this.authPath}/refresh-token`) {
            const refreshed = await this._tryRefresh();
            if (refreshed) {
                // Replay with the new token in the Authorization header.
                const retryHeaders = { ...headers, Authorization: `Bearer ${this.getToken()}` };
                return this._request(path, { ...options, headers: retryHeaders }, true);
            }
            // Refresh failed — the user is effectively logged out.
            // Don't redirect here; let the caller decide UI behaviour.
            this.clearStorage();
        }

        return { ok: response.ok, status: response.status, data };
    }

    // Single-flight refresh. Concurrent callers share the same promise.
    async _tryRefresh() {
        if (this._refreshInFlight) return this._refreshInFlight;

        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return false;

        this._refreshInFlight = (async () => {
            try {
                const response = await fetch(`${this.apiUrl}${this.authPath}/refresh-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
                if (!response.ok) return false;

                const data = await response.json().catch(() => null);
                if (!data || !data.token) return false;

                this.setToken(data.token);
                if (data.refreshToken) this.setRefreshToken(data.refreshToken);
                return true;
            } catch {
                return false;
            } finally {
                // Allow the next caller to start a fresh attempt.
                this._refreshInFlight = null;
            }
        })();

        return this._refreshInFlight;
    }

    // Public endpoint methods
    // All methods return `{ success, data?, error?, status? }`. Callers
    // never need to handle response.ok themselves; they switch on
    // `result.success`.

    async register(userData) {
        const { ok, data, status } = await this._request(`${this.authPath}/register`, {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (ok) {
            if (data.token) this.setToken(data.token);
            if (data.refreshToken) this.setRefreshToken(data.refreshToken);
            if (data.user) this.setUser(data.user);
            return { success: true, data };
        }
        return { success: false, error: data.error || 'Registration failed', status };
    }

    async login(credentials) {
        const { ok, data, status } = await this._request(`${this.authPath}/login`, {
            method: 'POST',
            body: JSON.stringify(credentials)
        });

        if (ok) {
            if (data.token) this.setToken(data.token);
            if (data.refreshToken) this.setRefreshToken(data.refreshToken);
            if (data.user) this.setUser(data.user);
            return { success: true, data };
        }
        return { success: false, error: data.error || 'Login failed', status };
    }

    // to avoid leaking which emails exist in the database (a classic
    // user-enumeration attack vector). The backend returns 200 with a
    // generic message regardless, but defence in depth.
    async forgotPassword(email) {
        const { status } = await this._request(`${this.authPath}/forgot-password`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        if (status === 429) {
            return { success: false, error: 'Too many requests. Please wait a few minutes and try again.', status };
        }

        return {
            success: true,
            message: 'If an account with that email exists, a reset link has been sent.'
        };
    }

    async resetPassword(token, password) {
        const { ok, data, status } = await this._request(`${this.authPath}/reset-password/${encodeURIComponent(token)}`, {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        if (ok) return { success: true, message: data.message || 'Password reset successful' };
        if (status === 429) {
            return { success: false, error: 'Too many requests. Please wait and try again.', status };
        }
        return { success: false, error: data.error || 'Failed to reset password', status };
    }

    async verifyEmail(token) {
        const { ok, data, status } = await this._request(
            `${this.authPath}/verify-email/${encodeURIComponent(token)}`,
            { method: 'GET' }
        );
        if (ok) return { success: true, message: data.message };
        return { success: false, error: data.error || 'Verification failed', status };
    }

    async resendVerification(email) {
        const { ok, data, status } = await this._request(`${this.authPath}/resend-verification`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        if (status === 429) {
            return { success: false, error: 'Too many requests. Please wait before requesting another email.', status };
        }
        // Always return success-shaped result regardless of whether the
        // email exists — same anti-enumeration logic as forgotPassword.
        if (ok || status === 400) {
            return { success: true, message: data.message || 'If your account needs verification, an email has been sent.' };
        }
        return { success: false, error: data.error || 'Failed to send verification email', status };
    }

    // For change-password-when-logged-in (Settings page). Different
    // from resetPassword which uses a magic-link token.
    async updatePassword(currentPassword, newPassword) {
        const { ok, data, status } = await this._request(`${this.authPath}/update-password`, {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        if (ok) return { success: true, message: data.message || 'Password updated' };
        return { success: false, error: data.error || 'Failed to update password', status };
    }

    async logout() {
        try {
            // Best-effort server-side logout. If it fails (e.g., token
            // already expired), we still want to clear local state.
            await this._request(`${this.authPath}/logout`, { method: 'POST' });
        } catch (e) {
            console.warn('Logout request failed (clearing local storage anyway):', e.message);
        }
        this.clearStorage();
        return { success: true };
    }

    // Used by services/authService.js to bootstrap user state on app
    // load. Returns the current user from the server (so we have the
    // freshest role/verified status).
    async getMe() {
        const { ok, data, status } = await this._request(`${this.usersPath}/profile`, { method: 'GET' });
        if (ok) {
            const user = data.user || data;
            if (user) this.setUser(user);
            return { success: true, user };
        }
        return { success: false, error: data.error || 'Failed to fetch profile', status };
    }

    // Manual refresh — usually `_tryRefresh()` is enough, but exposed
    // for code that wants explicit control. Returns the new token, or
    // null if refresh failed.
    async refreshToken() {
        const ok = await this._tryRefresh();
        return ok ? this.getToken() : null;
    }
}

window.AuthAPI = AuthAPI;
