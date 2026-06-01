/**
 * Playlists API Client
 */

class PlaylistsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async create(data) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Create playlist error:', error);
            return { error: 'Failed to create playlist' };
        }
    }

    async getUserPlaylists() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get playlists error:', error);
            return [];
        }
    }

    async getById(id) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get playlist error:', error);
            return null;
        }
    }

    async getFeatured() {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/featured`);
            return await response.json();
        } catch (error) {
            console.error('Get featured playlists error:', error);
            return [];
        }
    }

    async update(id, data) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Update playlist error:', error);
            return { error: 'Failed to update playlist' };
        }
    }

    async delete(id) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Delete playlist error:', error);
            return { error: 'Failed to delete playlist' };
        }
    }

    async addSong(playlistId, songId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/${playlistId}/add-song`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songId })
            });
            return await response.json();
        } catch (error) {
            console.error('Add song to playlist error:', error);
            return { error: 'Failed to add song' };
        }
    }

    async removeSong(playlistId, songId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/${playlistId}/remove-song`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songId })
            });
            return await response.json();
        } catch (error) {
            console.error('Remove song from playlist error:', error);
            return { error: 'Failed to remove song' };
        }
    }

    async like(playlistId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PLAYLISTS}/${playlistId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Like playlist error:', error);
            return { error: 'Failed to like playlist' };
        }
    }
}

window.PlaylistsAPI = PlaylistsAPI;