/**
 * Artists API Client
 */

class ArtistsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async getDashboard() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get dashboard error:', error);
            return null;
        }
    }

    async getAnalytics() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/analytics`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get analytics error:', error);
            return null;
        }
    }

    async getEarnings() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/earnings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get earnings error:', error);
            return null;
        }
    }

    async updateProfile(data) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/profile`, {
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

    async getMySongs() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/songs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get songs error:', error);
            return [];
        }
    }

    async getMyAlbums() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/albums`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get albums error:', error);
            return [];
        }
    }

    async requestWithdrawal(amount, method, accountDetails) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/withdraw`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount, method, accountDetails })
            });
            return await response.json();
        } catch (error) {
            console.error('Withdrawal error:', error);
            return { error: 'Failed to request withdrawal' };
        }
    }

    async getWithdrawals() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/withdrawals`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get withdrawals error:', error);
            return [];
        }
    }

    async purchaseCredits(packageId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/purchase-credits`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ packageId })
            });
            return await response.json();
        } catch (error) {
            console.error('Purchase credits error:', error);
            return { error: 'Failed to purchase credits' };
        }
    }

    async getSubscription() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/subscription`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get subscription error:', error);
            return null;
        }
    }

    async getById(artistId) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ARTISTS}/${artistId}`);
            return await response.json();
        } catch (error) {
            console.error('Get artist error:', error);
            return null;
        }
    }
}

window.ArtistsAPI = ArtistsAPI;