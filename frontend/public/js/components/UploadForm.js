/**
 * Upload Form Component
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
        this.uploadHandle = null; // { promise, abort } from UploadAPI

        // Preserve user input across content-type switches so they
        // don't lose what they typed when they toggle audio <-> video.
        this.formValues = {
            title: '', genre: '', price: '0', isPremium: false,
            tags: '', lyrics: '', artistId: ''
        };

        this.init();
    }

    async init() {
        if (this.isAdmin) {
            await this._loadArtists();
        }
        this._render();
    }

    async _loadArtists() {
        try {
            const { ok, data } = await window.authService.api._request('/admin/artists/list?limit=500', {
                method: 'GET'
            });
            if (ok && data?.artists) {
                this.artists = data.artists;
            }
        } catch (err) {
            console.warn('Failed to load artists for admin upload:', err.message);
        }
    }

    // Allowed file extensions — must match backend storageService
    get _allowedAudioExt() {
        return ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac'];
    }
    get _allowedVideoExt() {
        return ['.mp4', '.webm', '.mov', '.m4v'];
    }
    get _allowedImageExt() {
        return ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    }

    _maxAudioMB() { return (window.APP_CONFIG?.MAX_AUDIO_SIZE_MB) || 20; }
    _maxVideoMB() { return (window.APP_CONFIG?.MAX_VIDEO_SIZE_MB) || 500; }
    _maxImageMB() { return 5; }

    _extOf(filename) {
        const m = /\.[a-zA-Z0-9]+$/.exec(filename || '');
        return m ? m[0].toLowerCase() : '';
    }

    _formatFileSize(bytes) {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    _genres() {
        // Read from the global if present (config.js sets it), else
        // fall back to the canonical list. Keeping the fallback in
        if (Array.isArray(window.GENRES) && window.GENRES.length > 0) {
            return window.GENRES;
        }
        return [
            'Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae',
            'Gospel', 'Traditional', 'Amapiano', 'Cuundu', 'Soul',
            'Rock', 'Kalindula', 'Other'
        ];
    }

    // Render

    _render() {
        if (!this.container) return;

        const v = this.formValues;
        const genres = this._genres();
        const ext = this.contentType === 'audio' ? this._allowedAudioExt : this._allowedVideoExt;
        const maxMB = this.contentType === 'audio' ? this._maxAudioMB() : this._maxVideoMB();
        const acceptAttr = ext.join(',');

        this.container.innerHTML = `
            <div class="upload-container" data-upload-root>
                <div class="content-type-selector">
                    <button class="content-type-btn ${this.contentType === 'audio' ? 'active' : ''}" type="button" data-action="set-type" data-type="audio">
                        <i class="fas fa-music"></i> Audio Song (Max ${this._maxAudioMB()}MB)
                    </button>
                    <button class="content-type-btn ${this.contentType === 'video' ? 'active' : ''}" type="button" data-action="set-type" data-type="video">
                        <i class="fas fa-video"></i> Video Song (Max ${this._maxVideoMB()}MB)
                    </button>
                </div>

                <div class="upload-area" data-section="picker">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Drag & drop your ${this.contentType} file here or click to browse</p>
                    <p class="file-limit">
                        Max ${maxMB}MB &middot; Formats: ${ext.join(', ').toUpperCase()}
                    </p>
                    <input type="file" id="media-file" accept="${acceptAttr}" style="display: none" data-action="file-pick">
                    <button class="btn-secondary" type="button" data-action="browse">Browse Files</button>
                </div>

                <div class="upload-preview" data-section="preview" style="display: none;">
                    <h3>File Ready to Upload</h3>
                    <div class="file-info">
                        <p><strong>Name:</strong> <span id="file-name"></span></p>
                        <p><strong>Size:</strong> <span id="file-size"></span></p>
                    </div>

                    <div class="upload-form-fields">
                        <div class="form-group">
                            <label for="song-title">Song Title *</label>
                            <input type="text" id="song-title" required maxlength="200"
                                value="${this._escapeHtml(v.title)}"
                                placeholder="Enter song title">
                        </div>
                        <div class="form-group">
                            <label for="song-genre">Genre *</label>
                            <select id="song-genre" required>
                                <option value="">Select Genre</option>
                                ${genres.map(g => `
                                    <option value="${this._escapeHtml(g)}" ${v.genre === g ? 'selected' : ''}>
                                        ${this._escapeHtml(g)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        ${this.isAdmin ? this._renderArtistDropdown() : ''}
                        <div class="form-group">
                            <label for="cover-file">Cover Art (Optional)</label>
                            <input type="file" id="cover-file" accept="${this._allowedImageExt.join(',')}">
                            <small>Recommended: 500x500. JPG/PNG/WebP, max ${this._maxImageMB()}MB.</small>
                            <div id="cover-preview" style="margin-top: 8px;"></div>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="song-premium" ${v.isPremium ? 'checked' : ''} data-action="toggle-premium">
                                Premium Content (requires a price)
                            </label>
                        </div>
                        <div class="form-group" id="price-group" style="display: ${v.isPremium ? 'block' : 'none'};">
                            <label for="song-price">Price (Kwacha) *</label>
                            <input type="number" id="song-price" value="${this._escapeHtml(v.price)}"
                                step="0.01" min="1" placeholder="0.00">
                            <small>Set the price listeners pay for premium access.</small>
                        </div>
                        <div class="form-group">
                            <label for="song-tags">Tags (comma separated)</label>
                            <input type="text" id="song-tags"
                                value="${this._escapeHtml(v.tags)}"
                                placeholder="afrobeat, zambian, new">
                        </div>
                        <div class="form-group">
                            <label for="song-lyrics">Lyrics (Optional)</label>
                            <textarea id="song-lyrics" rows="4" maxlength="10000"
                                placeholder="Enter song lyrics...">${this._escapeHtml(v.lyrics)}</textarea>
                        </div>
                    </div>

                    <div class="upload-actions" style="display: flex; gap: 8px; margin-top: 16px;">
                        <button class="btn-primary" type="button" data-action="confirm-upload">
                            Upload ${this.contentType === 'video' ? 'Video' : 'Song'}
                        </button>
                        <button class="btn-secondary" type="button" data-action="cancel-preview">Cancel</button>
                    </div>
                </div>

                <div class="upload-progress" data-section="progress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                    </div>
                    <p id="progress-text">Preparing...</p>
                    <p id="progress-details" style="font-size: 12px; color: #888; margin-top: 4px;"></p>
                    <button class="btn-outline" type="button" data-action="abort-upload" style="margin-top: 12px;">
                        Cancel Upload
                    </button>
                </div>

                <div class="upload-success" data-section="success" style="display: none;">
                    <i class="fas fa-check-circle"></i>
                    <h3>Upload Complete!</h3>
                    <p>${this.isAdmin
                        ? 'Your song has been uploaded and published.'
                        : 'Your song has been uploaded and is pending approval.'}</p>
                    <div style="display: flex; gap: 8px; justify-content: center; margin-top: 16px;">
                        <button class="btn-primary" type="button" data-action="upload-more">Upload More</button>
                        <button class="btn-outline" type="button" data-action="view-songs">View My Songs</button>
                    </div>
                </div>
            </div>
        `;

        this._attachDelegatedListeners();
    }

    _renderArtistDropdown() {
        if (!this.artists || this.artists.length === 0) {
            return `
                <div class="form-group">
                    <label>Artist *</label>
                    <p style="color: #ff9800; font-size: 14px;">No artists available to upload for.</p>
                </div>
            `;
        }
        const v = this.formValues;
        return `
            <div class="form-group">
                <label for="artist-id">Artist *</label>
                <select id="artist-id" required>
                    <option value="">Select Artist</option>
                    ${this.artists.map(a => `
                        <option value="${this._escapeHtml(a._id)}" ${v.artistId === a._id ? 'selected' : ''}>
                            ${this._escapeHtml(a.stageName)} ${a.email ? '(' + this._escapeHtml(a.email) + ')' : ''}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    // Single delegated click handler — no listener accumulation
    _attachDelegatedListeners() {
        if (!this.container) return;
        const root = this.container.querySelector('[data-upload-root]');
        if (!root) return;

        // Click handler — every interactive element has a data-action.
        root.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;

            switch (action) {
                case 'set-type':
                    this._setContentType(target.dataset.type);
                    break;
                case 'browse':
                case 'file-pick':
                    // Clicking the file input directly is fine; this catches the button.
                    if (action === 'browse') {
                        document.getElementById('media-file')?.click();
                    }
                    break;
                case 'toggle-premium':
                    this._onPremiumToggle();
                    break;
                case 'confirm-upload':
                    this._uploadContent();
                    break;
                case 'cancel-preview':
                    this._cancelPreview();
                    break;
                case 'abort-upload':
                    this._abortUpload();
                    break;
                case 'upload-more':
                    this._reset();
                    break;
                case 'view-songs':
                    this._navigateAfterUpload();
                    break;
            }
        });

        // File input change
        const mediaFile = document.getElementById('media-file');
        if (mediaFile) {
            mediaFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) this._handleFile(e.target.files[0]);
            });
        }

        // Cover preview
        const coverFile = document.getElementById('cover-file');
        if (coverFile) {
            coverFile.addEventListener('change', (e) => this._handleCover(e.target.files[0]));
        }

        // Drag-and-drop on the picker section
        const picker = root.querySelector('[data-section="picker"]');
        if (picker) {
            picker.addEventListener('click', (e) => {
                // Don't double-trigger if they clicked the "Browse" button.
                if (e.target.closest('[data-action="browse"]')) return;
                document.getElementById('media-file')?.click();
            });
            picker.addEventListener('dragover', (e) => {
                e.preventDefault();
                picker.classList.add('dragover');
            });
            picker.addEventListener('dragleave', () => picker.classList.remove('dragover'));
            picker.addEventListener('drop', (e) => {
                e.preventDefault();
                picker.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) this._handleFile(e.dataTransfer.files[0]);
            });
        }
    }

    _setContentType(type) {
        if (type !== 'audio' && type !== 'video') return;
        if (this.isUploading) return; // can't switch mid-upload
        this._saveFormValues();
        this.contentType = type;
        this.selectedAudio = null;
        this.selectedVideo = null;
        this._render();
    }

    _saveFormValues() {
        this.formValues = {
            title: document.getElementById('song-title')?.value || this.formValues.title,
            genre: document.getElementById('song-genre')?.value || this.formValues.genre,
            price: document.getElementById('song-price')?.value || this.formValues.price,
            isPremium: document.getElementById('song-premium')?.checked ?? this.formValues.isPremium,
            tags: document.getElementById('song-tags')?.value || this.formValues.tags,
            lyrics: document.getElementById('song-lyrics')?.value || this.formValues.lyrics,
            artistId: document.getElementById('artist-id')?.value || this.formValues.artistId
        };
    }

    // File handling

    _handleFile(file) {
        const validation = this._validateMediaFile(file);
        if (!validation.ok) {
            Toast.show(validation.error, 'error');
            return;
        }
        if (this.contentType === 'audio') this.selectedAudio = file;
        else this.selectedVideo = file;
        this._showPreview(file);
    }

    _validateMediaFile(file) {
        const ext = this._extOf(file.name);
        const allowed = this.contentType === 'audio' ? this._allowedAudioExt : this._allowedVideoExt;
        if (!allowed.includes(ext)) {
            return {
                ok: false,
                error: `Unsupported ${this.contentType} format "${ext || file.type || 'unknown'}". Allowed: ${allowed.join(', ')}`
            };
        }
        const maxMB = this.contentType === 'audio' ? this._maxAudioMB() : this._maxVideoMB();
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxMB) {
            return {
                ok: false,
                error: `File too large (${sizeMB.toFixed(2)}MB). Maximum ${maxMB}MB.`
            };
        }
        if (file.size === 0) {
            return { ok: false, error: 'File appears to be empty.' };
        }
        return { ok: true };
    }

    _handleCover(file) {
        const preview = document.getElementById('cover-preview');
        if (!file) {
            this.selectedCover = null;
            if (preview) preview.innerHTML = '';
            return;
        }

        const ext = this._extOf(file.name);
        if (!this._allowedImageExt.includes(ext)) {
            Toast.show(`Unsupported image format "${ext}". Allowed: ${this._allowedImageExt.join(', ')}`, 'error');
            const input = document.getElementById('cover-file');
            if (input) input.value = '';
            return;
        }
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > this._maxImageMB()) {
            Toast.show(`Cover image too large (${sizeMB.toFixed(2)}MB). Max ${this._maxImageMB()}MB.`, 'error');
            const input = document.getElementById('cover-file');
            if (input) input.value = '';
            return;
        }

        this.selectedCover = file;
        if (preview) {
            const objectUrl = URL.createObjectURL(file);
            preview.innerHTML = `<img src="${objectUrl}" alt="Cover preview" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover;">`;
            // Revoke object URL on next render to avoid leaks.
            setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
        }
    }

    _showPreview(file) {
        const root = this.container.querySelector('[data-upload-root]');
        if (!root) return;
        root.querySelector('[data-section="picker"]').style.display = 'none';
        root.querySelector('[data-section="preview"]').style.display = 'block';

        const fileNameEl = document.getElementById('file-name');
        const fileSizeEl = document.getElementById('file-size');

        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) {
            const sizeMB = file.size / (1024 * 1024);
            const maxMB = this.contentType === 'audio' ? this._maxAudioMB() : this._maxVideoMB();
            fileSizeEl.textContent = `${this._formatFileSize(file.size)} (of ${maxMB}MB max)`;
            // Warning when close to limit
            if (sizeMB > maxMB * 0.9) {
                const warn = document.createElement('small');
                warn.style.color = '#ffc107';
                warn.style.display = 'block';
                warn.style.marginTop = '4px';
                warn.textContent = `⚠ Close to the maximum file size.`;
                fileSizeEl.parentNode.appendChild(warn);
            }
        }
    }

    _cancelPreview() {
        if (this.contentType === 'audio') this.selectedAudio = null;
        else this.selectedVideo = null;
        this._saveFormValues();
        this._render();
    }

    _onPremiumToggle() {
        const checkbox = document.getElementById('song-premium');
        const priceGroup = document.getElementById('price-group');
        const priceInput = document.getElementById('song-price');
        if (!checkbox || !priceGroup) return;
        if (checkbox.checked) {
            priceGroup.style.display = 'block';
            if (priceInput && (!priceInput.value || priceInput.value === '0')) {
                priceInput.value = '';
                priceInput.focus();
            }
        } else {
            priceGroup.style.display = 'none';
            if (priceInput) priceInput.value = '0';
        }
    }

    // Upload

    async _uploadContent() {
        if (this.isUploading) {
            Toast.show('Upload already in progress', 'warning');
            return;
        }

        // Re-validate file (in case anything changed).
        const file = this.contentType === 'audio' ? this.selectedAudio : this.selectedVideo;
        if (!file) {
            Toast.show(`Please select ${this.contentType === 'audio' ? 'an audio' : 'a video'} file first`, 'warning');
            return;
        }

        // Read + validate form
        const title = document.getElementById('song-title')?.value.trim() || '';
        const genre = document.getElementById('song-genre')?.value || '';
        const isPremium = document.getElementById('song-premium')?.checked || false;
        const price = document.getElementById('song-price')?.value || '0';
        const tags = document.getElementById('song-tags')?.value.trim() || '';
        const lyrics = document.getElementById('song-lyrics')?.value || '';
        const artistId = this.isAdmin ? (document.getElementById('artist-id')?.value || '') : null;
        const coverFile = this.selectedCover;

        if (!title) { Toast.show('Please enter a song title', 'warning'); return; }
        if (title.length > 200) { Toast.show('Title is too long (max 200 chars)', 'warning'); return; }
        if (!genre) { Toast.show('Please select a genre', 'warning'); return; }
        if (this.isAdmin && !artistId) { Toast.show('Please select an artist', 'warning'); return; }

        // Premium + price consistency check.
        if (isPremium) {
            const numPrice = parseFloat(price);
            if (!Number.isFinite(numPrice) || numPrice <= 0) {
                Toast.show('Premium songs need a price above 0', 'warning');
                return;
            }
        }

        // Build FormData
        const formData = new FormData();
        if (this.contentType === 'audio') {
            formData.append('audio', file);
        } else {
            formData.append('video', file);
        }
        formData.append('title', title);
        formData.append('genre', genre);
        formData.append('isPremium', String(isPremium));
        formData.append('price', isPremium ? price : '0');
        if (tags) formData.append('tags', tags);
        if (lyrics) formData.append('lyrics', lyrics);
        if (coverFile) formData.append('coverArt', coverFile);
        if (this.isAdmin && artistId) formData.append('artistId', artistId);

        // Switch UI to progress state
        this.isUploading = true;
        this._switchSection('progress');
        this._updateProgress(0, `Starting upload of ${file.name}...`);

        // Kick off the upload via UploadAPI (XHR with real progress)
        const uploadAPI = new UploadAPI();
        if (this.isAdmin) {
            this.uploadHandle = uploadAPI.adminUploadSong(this.contentType, formData, (p) => this._onProgressUpdate(p));
        } else {
            this.uploadHandle = uploadAPI.uploadSong(formData, (p) => this._onProgressUpdate(p));
        }

        try {
            const result = await this.uploadHandle.promise;

            if (result.success) {
                this._updateProgress(100, 'Upload complete!');
                this._switchSection('success');
                Toast.show(result.data?.message || 'Upload successful!', 'success');
            } else if (result.cancelled) {
                Toast.show('Upload cancelled', 'info');
                this._reset();
            } else {
                Toast.show(result.error || 'Upload failed', 'error');
                // Go back to preview so they can retry without re-picking the file.
                this._saveFormValues();
                this._switchSection('preview');
            }
        } catch (err) {
            // Should be rare — UploadAPI normalizes most errors into the
            // resolution path.
            Toast.show('Unexpected error: ' + (err.message || 'unknown'), 'error');
            this._switchSection('preview');
        } finally {
            this.isUploading = false;
            this.uploadHandle = null;
        }
    }

    _onProgressUpdate({ loaded, total, percent }) {
        const text = percent < 100
            ? `Uploading... ${percent}%`
            : 'Processing on server...';
        const details = `${this._formatFileSize(loaded)} of ${this._formatFileSize(total)}`;
        this._updateProgress(percent, text, details);
    }

    _updateProgress(percent, text, details = '') {
        const fill = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');
        const detailsEl = document.getElementById('progress-details');
        if (fill) fill.style.width = `${percent}%`;
        if (textEl) textEl.textContent = text;
        if (detailsEl) detailsEl.textContent = details;
    }

    _abortUpload() {
        if (!this.isUploading) return;
        if (this.uploadHandle && typeof this.uploadHandle.abort === 'function') {
            this.uploadHandle.abort();
        }
    }

    _switchSection(section) {
        const root = this.container.querySelector('[data-upload-root]');
        if (!root) return;
        root.querySelectorAll('[data-section]').forEach(el => {
            el.style.display = (el.dataset.section === section) ? 'block' : 'none';
        });
    }

    _reset() {
        if (this.uploadHandle && this.isUploading) {
            this._abortUpload();
        }
        this.selectedAudio = null;
        this.selectedVideo = null;
        this.selectedCover = null;
        this.isUploading = false;
        this.uploadHandle = null;
        // Keep formValues so the user can quickly re-upload similar content.
        // Reset() is also called on the success-screen "Upload More" button —
        // which arguably should reset the values. Leaving them is friendlier
        // for batch uploads.
        this._render();
    }

    _navigateAfterUpload() {
        const user = window.authService?.getUser();
        if (user?.role === 'admin') {
            window.bravoApp?.navigateTo?.('admin/songs') || (window.location.hash = 'admin/songs');
        } else {
            window.bravoApp?.navigateTo?.('dashboard') || (window.location.hash = 'dashboard');
        }
    }
}

window.UploadForm = UploadForm;
