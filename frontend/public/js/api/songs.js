/**
 * Songs API Client
 */

class SongsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async getAll(page = 1, limit = 20, genre = null) {
        try {
            let url = `${this.apiUrl}${window.API_ENDPOINTS.SONGS}?page=${page}&limit=${limit}`;
            if (genre && genre !== 'all') url += `&genre=${encodeURIComponent(genre)}`;
            
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Get songs error:', error);
            return { songs: [], totalPages: 0, currentPage: 1, total: 0 };
        }
    }

    async getById(id) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Get song error:', error);
            return null;
        }
    }

    async getTrending() {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/trending`);
            return await response.json();
        } catch (error) {
            console.error('Get trending error:', error);
            return [];
        }
    }

    async getFeatured() {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/featured`);
            return await response.json();
        } catch (error) {
            console.error('Get featured error:', error);
            return [];
        }
    }

    async getRecent() {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/recent`);
            return await response.json();
        } catch (error) {
            console.error('Get recent error:', error);
            return [];
        }
    }

    async like(songId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/${songId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Like error:', error);
            return { error: 'Failed to like song' };
        }
    }

    async unlike(songId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/${songId}/like`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Unlike error:', error);
            return { error: 'Failed to unlike song' };
        }
    }

    async share(songId, platform = 'copy') {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/${songId}/share`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ platform })
            });
            return await response.json();
        } catch (error) {
            console.error('Share error:', error);
            return { error: 'Failed to share song' };
        }
    }

    async getByArtist(artistId) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/artist/${artistId}`);
            return await response.json();
        } catch (error) {
            console.error('Get by artist error:', error);
            return [];
        }
    }

    async getByGenre(genre) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/genre/${genre}`);
            return await response.json();
        } catch (error) {
            console.error('Get by genre error:', error);
            return [];
        }
    }

    async deleteSong(songId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SONGS}/${songId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Delete song error:', error);
            return { error: 'Failed to delete song' };
        }
    }
}

window.SongsAPI = SongsAPI;