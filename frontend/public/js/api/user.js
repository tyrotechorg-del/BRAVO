/**
 * User API Client
 */

class UserAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async getProfile() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get profile error:', error);
            return null;
        }
    }

    async updateProfile(data) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Update profile error:', error);
            return { error: 'Failed to update profile' };
        }
    }

    async updateAvatar(file) {
        try {
            const token = this.getToken();
            const formData = new FormData();
            formData.append('avatar', file);
            
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/profile`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Update avatar error:', error);
            return { error: 'Failed to update avatar' };
        }
    }

    async getFollowers() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/followers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get followers error:', error);
            return [];
        }
    }

    async getFollowing() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/following`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get following error:', error);
            return [];
        }
    }

    async followUser(userId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/follow/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Follow error:', error);
            return { error: 'Failed to follow user' };
        }
    }

    async unfollowUser(userId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/unfollow/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Unfollow error:', error);
            return { error: 'Failed to unfollow user' };
        }
    }

    async getHistory() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get history error:', error);
            return [];
        }
    }

    async getPlaylists() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/playlists`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get playlists error:', error);
            return [];
        }
    }

    async getSettings() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get settings error:', error);
            return null;
        }
    }

    async updateSettings(settings) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/settings`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            return await response.json();
        } catch (error) {
            console.error('Update settings error:', error);
            return { error: 'Failed to update settings' };
        }
    }

    async deleteAccount() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.USERS}/account`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Delete account error:', error);
            return { error: 'Failed to delete account' };
        }
    }
}

window.UserAPI = UserAPI;