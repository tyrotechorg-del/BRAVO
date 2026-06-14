

class AuthService {
    constructor() {
        // If the global instance already exists, return it. This means
        // `new AuthService()` always yields the same instance regardless
        // of how many callers do it — which is what the page code in
        // the wild does. The global is also exposed as `window.authService`.
        if (window.__authServiceInstance) {
            return window.__authServiceInstance;
        }

        this.api = new AuthAPI();
        // For event listeners that want to know when the user state
        // changes (Navbar/Sidebar render).
        this._listeners = new Set();

        window.__authServiceInstance = this;
    }

    // Subscribe to auth state changes
    onChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit() {
        const user = this.api.getUser();
        for (const fn of this._listeners) {
            try { fn(user); } catch (e) { console.error('auth listener error:', e); }
        }
    }

    // State accessors
    getUser() { return this.api.getUser(); }
    getToken() { return this.api.getToken(); }
    isAuthenticated() { return this.api.isAuthenticated(); }
    isTokenExpired() { return this.api.isTokenExpired(); }
    isAdmin() { return this.api.isAdmin(); }
    isArtist() { return this.api.isArtist(); }
    isListener() {
        const user = this.api.getUser();
        return Boolean(user && user.role === 'listener');
    }
    isEmailVerified() { return this.api.isEmailVerified(); }

    hasRole(role) {
        const user = this.api.getUser();
        return Boolean(user && user.role === role);
    }

    // Auth flow methods
    // Each one delegates to AuthAPI for HTTP work, then handles the
    // "state changed" notification + analytics ping.

    async login(credentials) {
        const result = await this.api.login(credentials);
        if (result.success) {
            window.analyticsService?.trackLogin?.('email');
            this._emit();
        }
        return result;
    }

    async register(userData) {
        const result = await this.api.register(userData);
        if (result.success) {
            window.analyticsService?.trackRegister?.(userData.role);
            this._emit();
        }
        return result;
    }

    async logout() {
        const result = await this.api.logout();
        this._emit();
        return result;
    }

    // The next four are pure passthroughs but kept on the service so
    // callers don't have to know which layer owns which endpoint.
    async forgotPassword(email) { return this.api.forgotPassword(email); }
    async resetPassword(token, password) { return this.api.resetPassword(token, password); }
    async verifyEmail(token) {
        const result = await this.api.verifyEmail(token);
        if (result.success) {
            // After successful verification, refresh user state so the
            // navbar/sidebar reflect the new isVerified flag.
            const me = await this.api.getMe();
            if (me.success) this._emit();
        }
        return result;
    }
    async resendVerification(email) { return this.api.resendVerification(email); }

    async updatePassword(currentPassword, newPassword) {
        return this.api.updatePassword(currentPassword, newPassword);
    }

    async refreshUser() {
        const result = await this.api.getMe();
        if (result.success) this._emit();
        return result;
    }
}

window.AuthService = AuthService;
// Eagerly create the singleton so `window.authService` is always available.
window.authService = new AuthService();
