/**
 * Authentication Service - With Email Verification (Artists Only)
 */

class AuthService {
    constructor() {
        this.storage = new StorageManager();
        this.apiUrl = window.API_BASE_URL;
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.token) this.storage.setToken(data.token);
                if (data.user) this.storage.setUser(data.user);
                window.analyticsService?.trackRegister(userData.role);
                return { success: true, user: data.user, message: data.message };
            }
            
            return { success: false, error: data.error };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error' };
        }
    }

    async login(credentials) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.storage.setToken(data.token);
                this.storage.setRefreshToken(data.refreshToken);
                this.storage.setUser(data.user);
                window.analyticsService?.trackLogin('email');
                return { success: true, user: data.user };
            }
            
            return { success: false, error: data.error };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error' };
        }
    }

    async verifyEmail(token) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/verify-email/${token}`);
            const data = await response.json();
            
            if (response.ok) {
                return { success: true, message: data.message };
            }
            return { success: false, error: data.error };
        } catch (error) {
            return { success: false, error: 'Verification failed' };
        }
    }

    async resendVerification(email) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            return { success: response.ok, message: data.message, error: data.error };
        } catch (error) {
            return { success: false, error: 'Failed to resend verification' };
        }
    }

    async forgotPassword(email) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            return { success: response.ok, message: data.message, error: data.error };
        } catch (error) {
            return { success: false, error: 'Failed to send reset email' };
        }
    }

    async resetPassword(token, password) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/reset-password/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            return { success: response.ok, message: data.message, error: data.error };
        } catch (error) {
            return { success: false, error: 'Password reset failed' };
        }
    }

    async logout() {
        try {
            const token = this.storage.getToken();
            await fetch(`${this.apiUrl}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        this.storage.clear();
        return { success: true };
    }

    async refreshToken() {
        const refreshToken = this.storage.getRefreshToken();
        if (!refreshToken) return null;
        
        try {
            const response = await fetch(`${this.apiUrl}/auth/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.storage.setToken(data.token);
                this.storage.setRefreshToken(data.refreshToken);
                return data.token;
            }
        } catch (error) {
            console.error('Refresh token error:', error);
        }
        return null;
    }

    // Add these methods to the AuthService class

async forgotPassword(email) {
    try {
        const response = await fetch(`${this.apiUrl}/auth/forgot-password`, {
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
        const response = await fetch(`${this.apiUrl}/auth/reset-password/${token}`, {
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

    async getCurrentUser() {
        const token = this.storage.getToken();
        if (!token) return null;
        
        try {
            const response = await fetch(`${this.apiUrl}/users/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                const user = data.user || data;
                this.storage.setUser(user);
                return user;
            }
        } catch (error) {
            console.error('Get current user error:', error);
        }
        
        return null;
    }

    isAuthenticated() {
        return !!this.storage.getToken();
    }

    getUser() {
        return this.storage.getUser();
    }

    hasRole(role) {
        const user = this.getUser();
        return user && user.role === role;
    }

    isArtist() {
        return this.hasRole('artist');
    }

    isAdmin() {
        return this.hasRole('admin');
    }

    isEmailVerified() {
        const user = this.getUser();
        return user && user.isVerified === true;
    }
}

window.AuthService = AuthService;