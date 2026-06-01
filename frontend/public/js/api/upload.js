/**
 * Upload API Client
 */

class UploadAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async uploadSong(formData) {
        try {
            const token = this.getToken();
            console.log('Uploading with token:', token ? 'Yes' : 'No');
            
            const response = await fetch(`${this.apiUrl}/songs/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const data = await response.json();
            console.log('Upload response:', data);
            
            if (!response.ok) {
                return { error: data.error || 'Upload failed' };
            }
            
            return data;
        } catch (error) {
            console.error('Upload error:', error);
            return { error: 'Network error. Please try again.' };
        }
    }

    async adminUploadSong(formData) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}/admin/upload-song`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                return { error: data.error || 'Upload failed' };
            }
            
            return data;
        } catch (error) {
            console.error('Admin upload error:', error);
            return { error: 'Network error. Please try again.' };
        }
    }
}

window.UploadAPI = UploadAPI;