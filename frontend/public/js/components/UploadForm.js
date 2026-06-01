/**
 * Upload Form Component - With Video Support & All Genres (Cuundu, Kalindula)
 * UPDATED: Audio max 20MB, Video max 500MB
 */

class UploadForm {
    constructor(containerId, isAdmin = false) {
        this.container = document.querySelector(containerId);
        this.selectedAudio = null;
        this.selectedVideo = null;
        this.selectedCover = null;
        this.isUploading = false;
        this.isAdmin = isAdmin;
        this.artists = [];
        this.contentType = 'audio';
        this.apiUrl = window.API_BASE_URL;
        this.init();
    }
    
    async init() {
        if (this.isAdmin) {
            await this.loadArtists();
        }
        this.render();
        this.attachEventListeners();
    }
    
    async loadArtists() {
        try {
            const adminAPI = new AdminAPI();
            const result = await adminAPI.getAllArtists();
            if (!result.error) {
                this.artists = result.artists || result;
            }
        } catch (error) {
            console.error('Load artists error:', error);
        }
    }
    
    render() {
        if (!this.container) return;
        
        // Complete genres list including Cuundu and Kalindula
        const genres = [
            'Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae',
            'Gospel', 'Traditional', 'Amapiano', 'House', 'Pop',
            'Rock', 'Jazz', 'Soul', 'Funk', 'Latin',
            'Cuundu', 'Kalindula'
        ];
        
        this.container.innerHTML = `
            <div class="upload-container">
                <!-- Content Type Selector -->
                <div class="content-type-selector">
                    <button class="content-type-btn ${this.contentType === 'audio' ? 'active' : ''}" data-type="audio">
                        <i class="fas fa-music"></i> Audio Song (Max 20MB)
                    </button>
                    <button class="content-type-btn ${this.contentType === 'video' ? 'active' : ''}" data-type="video">
                        <i class="fas fa-video"></i> Video Song (Max 500MB)
                    </button>
                </div>
                
                <!-- Step 1: File Selection -->
                <div class="upload-area" id="upload-area">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Drag & drop your ${this.contentType === 'audio' ? 'audio' : 'video'} file here or click to browse</p>
                    <p class="file-limit">${this.contentType === 'audio' ? 'Max 20MB (MP3, WAV, M4A)' : 'Max 500MB (MP4, MOV, AVI, WebM, MKV)'}</p>
                    <input type="file" id="media-file" accept="${this.contentType === 'audio' ? 'audio/*' : 'video/*'}" style="display: none">
                    <button class="btn-secondary" id="browse-btn">Browse Files</button>
                </div>
                
                <!-- Step 2: File Preview and Form -->
                <div class="upload-preview" id="upload-preview" style="display: none;">
                    <h3>File Ready to Upload</h3>
                    <div class="file-info">
                        <p><strong>Name:</strong> <span id="file-name"></span></p>
                        <p><strong>Size:</strong> <span id="file-size"></span></p>
                        <p><strong>Max Allowed:</strong> ${this.contentType === 'audio' ? '20MB' : '500MB'}</p>
                        ${this.contentType === 'video' ? '<p><strong>Type:</strong> Video Song</p>' : '<p><strong>Type:</strong> Audio Song</p>'}
                    </div>
                    
                    <div class="upload-form-fields">
                        <div class="form-group">
                            <label>Song Title *</label>
                            <input type="text" id="song-title" placeholder="Enter song title" required>
                        </div>
                        <div class="form-group">
                            <label>Genre *</label>
                            <select id="song-genre" required>
                                <option value="">Select Genre</option>
                                ${genres.map(g => `<option value="${g}">${g}</option>`).join('')}
                            </select>
                        </div>
                        ${this.isAdmin ? `
                            <div class="form-group">
                                <label>Artist *</label>
                                <select id="artist-id" required>
                                    <option value="">Select Artist</option>
                                    ${this.artists.map(a => `<option value="${a._id}">${a.stageName} (${a.email || 'No email'})</option>`).join('')}
                                </select>
                            </div>
                        ` : ''}
                        <div class="form-group">
                            <label>Cover Art (Optional)</label>
                            <input type="file" id="cover-file" accept="image/*">
                            <small>Recommended: 500x500 pixels, JPG or PNG (Max 5MB)</small>
                            <img src="${window.getDefaultImage()}" style="width: 50px; height: 50px; border-radius: 8px; margin-top: 10px;">
                        </div>
                        <div class="form-group">
                            <label>Price (Kwacha)</label>
                            <input type="number" id="song-price" value="0" step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="song-premium"> Premium Content
                            </label>
                        </div>
                        <div class="form-group">
                            <label>Tags (comma separated)</label>
                            <input type="text" id="song-tags" placeholder="afrobeat, zambian, new, cuundu, kalindula">
                        </div>
                        <div class="form-group">
                            <label>Lyrics (Optional)</label>
                            <textarea id="song-lyrics" rows="4" placeholder="Enter song lyrics..."></textarea>
                        </div>
                    </div>
                    
                    <button class="btn-primary" id="confirm-upload">Upload ${this.contentType === 'video' ? 'Video' : 'Song'}</button>
                    <button class="btn-secondary" id="cancel-upload">Cancel</button>
                </div>
                
                <!-- Step 3: Upload Progress -->
                <div class="upload-progress" id="upload-progress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                    </div>
                    <p id="progress-text">Uploading...</p>
                </div>
                
                <!-- Step 4: Upload Success -->
                <div class="upload-success" id="upload-success" style="display: none;">
                    <i class="fas fa-check-circle"></i>
                    <h3>Upload Complete!</h3>
                    <p>${this.isAdmin ? 'Your song has been uploaded and published.' : 'Your song has been uploaded and is pending approval.'}</p>
                    <button class="btn-primary" id="upload-more-btn">Upload More</button>
                    <button class="btn-outline" id="view-songs-btn">View My Songs</button>
                </div>
            </div>
        `;
    }
    
    attachEventListeners() {
        document.querySelectorAll('.content-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.contentType = btn.dataset.type;
                this.reset();
                this.render();
                this.attachEventListeners();
            });
        });
        
        const uploadArea = document.getElementById('upload-area');
        const browseBtn = document.getElementById('browse-btn');
        const mediaFile = document.getElementById('media-file');
        const confirmBtn = document.getElementById('confirm-upload');
        const cancelBtn = document.getElementById('cancel-upload');
        const uploadMoreBtn = document.getElementById('upload-more-btn');
        const viewSongsBtn = document.getElementById('view-songs-btn');
        
        if (browseBtn && mediaFile) {
            browseBtn.addEventListener('click', () => mediaFile.click());
            mediaFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFile(e.target.files[0]);
                }
            });
        }
        
        if (uploadArea) {
            uploadArea.addEventListener('click', () => mediaFile.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFile(files[0]);
                }
            });
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.uploadContent());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.reset());
        }
        
        if (uploadMoreBtn) {
            uploadMoreBtn.addEventListener('click', () => this.reset());
        }
        
        if (viewSongsBtn) {
            viewSongsBtn.addEventListener('click', () => {
                const user = JSON.parse(localStorage.getItem('bravo_user') || '{}');
                if (user.role === 'artist') {
                    window.location.hash = 'dashboard';
                } else {
                    window.location.hash = 'admin/songs';
                }
            });
        }
    }
    
    handleFile(file) {
        console.log('File selected:', file.name, file.type, file.size);
        
        if (!this.validateFile(file)) return;
        
        if (this.contentType === 'audio') {
            this.selectedAudio = file;
        } else {
            this.selectedVideo = file;
        }
        this.showPreview(file);
    }
    
    validateFile(file) {
        let validTypes = [];
        let maxSizeMB = 0;
        let maxSize = 0;
        
        if (this.contentType === 'audio') {
            validTypes = window.APP_CONFIG.ALLOWED_AUDIO_TYPES;
            maxSizeMB = window.APP_CONFIG.MAX_AUDIO_SIZE_MB || 20;
            maxSize = maxSizeMB * 1024 * 1024;
        } else {
            validTypes = window.APP_CONFIG.ALLOWED_VIDEO_TYPES;
            maxSizeMB = window.APP_CONFIG.MAX_VIDEO_SIZE_MB || 500;
            maxSize = maxSizeMB * 1024 * 1024;
        }
        
        const fileSizeMB = file.size / (1024 * 1024);
        
        if (!validTypes.includes(file.type)) {
            Toast.show(`Invalid file type. Please upload ${this.contentType === 'audio' ? 'MP3, WAV, M4A, or AAC' : 'MP4, MOV, AVI, WebM, or MKV video'} files.`, 'error');
            return false;
        }
        
        if (file.size > maxSize) {
            Toast.show(`File too large. Maximum size is ${maxSizeMB}MB. Your file: ${fileSizeMB.toFixed(2)}MB`, 'error');
            return false;
        }
        
        return true;
    }
    
    showPreview(file) {
        const uploadArea = document.getElementById('upload-area');
        const uploadPreview = document.getElementById('upload-preview');
        
        if (uploadArea) uploadArea.style.display = 'none';
        if (uploadPreview) uploadPreview.style.display = 'block';
        
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        
        const fileSizeMB = file.size / (1024 * 1024);
        const maxSizeMB = this.contentType === 'audio' 
            ? (window.APP_CONFIG.MAX_AUDIO_SIZE_MB || 20)
            : (window.APP_CONFIG.MAX_VIDEO_SIZE_MB || 500);
        
        if (fileName) fileName.textContent = file.name;
        if (fileSize) {
            fileSize.textContent = `${this.formatFileSize(file.size)} (${fileSizeMB.toFixed(2)}MB / ${maxSizeMB}MB max)`;
            
            // Add warning if file is close to size limit
            if (fileSizeMB > maxSizeMB * 0.9) {
                const warningSpan = document.createElement('small');
                warningSpan.style.color = '#ffc107';
                warningSpan.style.display = 'block';
                warningSpan.style.marginTop = '5px';
                warningSpan.textContent = '⚠️ Warning: File is close to the maximum size limit!';
                fileSize.parentNode.appendChild(warningSpan);
            }
        }
        
        document.getElementById('song-title').value = '';
        document.getElementById('song-genre').value = '';
        document.getElementById('song-price').value = '0';
        document.getElementById('song-premium').checked = false;
        document.getElementById('song-tags').value = '';
        document.getElementById('song-lyrics').value = '';
        if (document.getElementById('cover-file')) {
            document.getElementById('cover-file').value = '';
        }
    }
    
    async uploadContent() {
        if (this.isUploading) {
            Toast.show('Upload already in progress', 'warning');
            return;
        }
        
        if (this.contentType === 'audio' && !this.selectedAudio) {
            Toast.show('Please select an audio file first', 'warning');
            return;
        }
        
        if (this.contentType === 'video' && !this.selectedVideo) {
            Toast.show('Please select a video file first', 'warning');
            return;
        }
        
        const title = document.getElementById('song-title').value.trim();
        const genre = document.getElementById('song-genre').value;
        const price = document.getElementById('song-price').value;
        const isPremium = document.getElementById('song-premium').checked;
        const tags = document.getElementById('song-tags').value;
        const lyrics = document.getElementById('song-lyrics')?.value || '';
        const coverFile = document.getElementById('cover-file')?.files[0];
        let artistId = null;
        
        if (this.isAdmin) {
            artistId = document.getElementById('artist-id')?.value;
            if (!artistId) {
                Toast.show('Please select an artist', 'warning');
                return;
            }
        }
        
        if (!title) {
            Toast.show('Please enter a song title', 'warning');
            return;
        }
        
        if (!genre) {
            Toast.show('Please select a genre', 'warning');
            return;
        }
        
        console.log(`Uploading ${this.contentType}:`, title, genre);
        
        this.isUploading = true;
        
        const formData = new FormData();
        
        if (this.contentType === 'audio') {
            formData.append('audio', this.selectedAudio);
        } else {
            formData.append('video', this.selectedVideo);
        }
        
        formData.append('title', title);
        formData.append('genre', genre);
        formData.append('price', price);
        formData.append('isPremium', isPremium);
        formData.append('tags', tags);
        formData.append('lyrics', lyrics);
        if (coverFile) formData.append('coverArt', coverFile);
        if (this.isAdmin && artistId) formData.append('artistId', artistId);
        
        const uploadPreview = document.getElementById('upload-preview');
        const uploadProgress = document.getElementById('upload-progress');
        
        if (uploadPreview) uploadPreview.style.display = 'none';
        if (uploadProgress) uploadProgress.style.display = 'block';
        
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            if (progressFill) progressFill.style.width = `${Math.min(progress, 100)}%`;
            if (progressText) progressText.textContent = `Uploading... ${Math.min(progress, 100)}%`;
            if (progress >= 100) clearInterval(progressInterval);
        }, 500);
        
        try {
            let endpoint = '/songs/upload';
            
            if (this.isAdmin) {
                endpoint = this.contentType === 'video' ? '/admin/upload-video' : '/admin/upload-song';
            }
            
            const token = localStorage.getItem('bravo_token');
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            clearInterval(progressInterval);
            const progressFill = document.getElementById('progress-fill');
            if (progressFill) progressFill.style.width = '100%';
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }
            
            this.showSuccess();
            Toast.show(data.message || `${this.contentType === 'video' ? 'Video' : 'Song'} uploaded successfully!`, 'success');
            
        } catch (error) {
            clearInterval(progressInterval);
            console.error('Upload exception:', error);
            Toast.show(error.message || 'Upload failed. Please try again.', 'error');
            this.reset();
        } finally {
            this.isUploading = false;
        }
    }
    
    showSuccess() {
        const uploadProgress = document.getElementById('upload-progress');
        const uploadSuccess = document.getElementById('upload-success');
        
        if (uploadProgress) uploadProgress.style.display = 'none';
        if (uploadSuccess) uploadSuccess.style.display = 'block';
    }
    
    reset() {
        this.selectedAudio = null;
        this.selectedVideo = null;
        this.selectedCover = null;
        this.isUploading = false;
        
        const uploadArea = document.getElementById('upload-area');
        const uploadPreview = document.getElementById('upload-preview');
        const uploadProgress = document.getElementById('upload-progress');
        const uploadSuccess = document.getElementById('upload-success');
        
        if (uploadArea) uploadArea.style.display = 'block';
        if (uploadPreview) uploadPreview.style.display = 'none';
        if (uploadProgress) uploadProgress.style.display = 'none';
        if (uploadSuccess) uploadSuccess.style.display = 'none';
        
        const mediaFile = document.getElementById('media-file');
        const coverFile = document.getElementById('cover-file');
        if (mediaFile) mediaFile.value = '';
        if (coverFile) coverFile.value = '';
        
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = 'Uploading...';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

window.UploadForm = UploadForm;