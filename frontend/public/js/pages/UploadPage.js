/**
 * Upload Page
 */

class UploadPage {
    constructor() {
        this.uploadForm = null;
    }

    render() {
        const token = localStorage.getItem('bravo_token');
        const user = JSON.parse(localStorage.getItem('bravo_user') || '{}');
        
        if (!token) {
            window.location.hash = 'login';
            return '<div class="error">Please login to upload music</div>';
        }
        
        if (user.role !== 'artist' && user.role !== 'admin') {
            return '<div class="error">Artist account required to upload music</div>';
        }
        
        return `
            <div class="upload-page-container">
                <h1>Upload Music</h1>
                <div id="upload-form-container"></div>
            </div>
        `;
    }

    async afterRender() {
        const container = document.getElementById('upload-form-container');
        if (container) {
            this.uploadForm = new UploadForm('#upload-form-container');
        }
    }
}

window.UploadPage = UploadPage;