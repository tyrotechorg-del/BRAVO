/**
 * Authentication API Client
 */

class AuthAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    setToken(token) {
        localStorage.setItem('bravo_token', token);
    }

    getRefreshToken() {
        return localStorage.getItem('bravo_refresh_token');
    }

    setRefreshToken(token) {
        localStorage.setItem('bravo_refresh_token', token);
    }

    setUser(user) {
        localStorage.setItem('bravo_user', JSON.stringify(user));
    }

    getUser() {
        const user = localStorage.getItem('bravo_user');
        return user ? JSON.parse(user) : null;
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.AUTH}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.token) this.setToken(data.token);
                if (data.refreshToken) this.setRefreshToken(data.refreshToken);
                if (data.user) this.setUser(data.user);
                return { success: true, data };
            }
            return { success: false, error: data.error || 'Registration failed' };
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    async login(credentials) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.AUTH}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.token) this.setToken(data.token);
                if (data.refreshToken) this.setRefreshToken(data.refreshToken);
                if (data.user) this.setUser(data.user);
                return { success: true, data };
            }
            return { success: false, error: data.error || 'Login failed' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    }

    async logout() {
        try {
            const token = this.getToken();
            await fetch(`${this.apiUrl}${window.API_ENDPOINTS.AUTH}/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        localStorage.removeItem('bravo_token');
        localStorage.removeItem('bravo_refresh_token');
        localStorage.removeItem('bravo_user');
        
        return { success: true };
    }

    async refreshToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) return null;
            
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.AUTH}/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.setToken(data.token);
                this.setRefreshToken(data.refreshToken);
                return data.token;
            }
        } catch (error) {
            console.error('Refresh token error:', error);
        }
        return null;
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    }

    isArtist() {
        const user = this.getUser();
        return user && user.role === 'artist';
    }

    async forgotPassword(email) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.AUTH}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, message: data.message };
            }
            return { success: false, error: data.error };
        } catch (error) {
            console.error('Forgot password error:', error);
            return { success: false, error: 'Network error' };
        }
    }

    async resetPassword(token, password) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.AUTH}/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, message: data.message };
            }
            return { success: false, error: data.error };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: 'Network error' };
        }
    }
}

window.AuthAPI = AuthAPI;