/**
 * Albums API Client
 */

class AlbumsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async getAll(page = 1, limit = 20, genre = null) {
        try {
            let url = `${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}?page=${page}&limit=${limit}`;
            if (genre) url += `&genre=${encodeURIComponent(genre)}`;
            
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Get albums error:', error);
            return { albums: [], totalPages: 0, currentPage: 1, total: 0 };
        }
    }

    async getById(id) {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/${id}`);
            return await response.json();
        } catch (error) {
            console.error('Get album error:', error);
            return null;
        }
    }

    async getTrending() {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/trending`);
            return await response.json();
        } catch (error) {
            console.error('Get trending albums error:', error);
            return [];
        }
    }

    async getMyAlbums() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/my/albums`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get my albums error:', error);
            return [];
        }
    }

    async getArtistAlbums(userId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/artist/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get artist albums error:', error);
            return [];
        }
    }

    async create(formData) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/create`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Create album error:', error);
            return { error: 'Failed to create album' };
        }
    }

    async update(id, data) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Update album error:', error);
            return { error: 'Failed to update album' };
        }
    }

    async updateWithCover(id, formData) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Update album with cover error:', error);
            return { error: 'Failed to update album' };
        }
    }

    async delete(id) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Delete album error:', error);
            return { error: 'Failed to delete album' };
        }
    }

    async addSong(albumId, songId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/${albumId}/add-song`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songId })
            });
            return await response.json();
        } catch (error) {
            console.error('Add song to album error:', error);
            return { error: 'Failed to add song' };
        }
    }

    async removeSong(albumId, songId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/${albumId}/remove-song`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songId })
            });
            return await response.json();
        } catch (error) {
            console.error('Remove song from album error:', error);
            return { error: 'Failed to remove song' };
        }
    }

    async purchase(id) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.ALBUMS}/${id}/purchase`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Purchase album error:', error);
            return { error: 'Failed to purchase album' };
        }
    }
}

window.AlbumsAPI = AlbumsAPI;