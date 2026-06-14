/**
 * Admin Dashboard
 */

class AdminDashboardPage {
    constructor() {
        this.analytics = null;
        this.revenueAnalytics = null;
        this.pendingCount = 0;
        this.adminAPI = new AdminAPI();
        this.loading = true;
    }

    async render() {
        return `
            <div class="admin-dashboard">
                <div class="page-header">
                    <h1><i class="fas fa-chart-line"></i> Admin Dashboard</h1>
                    <p>Platform overview and quick actions.</p>
                </div>

                <div id="admin-stats-container">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div class="admin-actions" style="margin: 24px 0; display:flex; flex-wrap:wrap; gap:8px;">
                    <button class="btn-primary" type="button" id="refresh-data-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                    <button class="btn-outline" type="button" id="trigger-backup-btn">
                        <i class="fas fa-database"></i> Trigger Backup
                    </button>
                    <button class="btn-outline" type="button" id="admin-upload-song-btn">
                        <i class="fas fa-music"></i> Upload Song
                    </button>
                    <button class="btn-outline" type="button" id="admin-upload-video-btn">
                        <i class="fas fa-video"></i> Upload Video
                    </button>
                    <button class="btn-outline" type="button" id="admin-create-album-btn">
                        <i class="fas fa-compact-disc"></i> Create Album
                    </button>
                </div>

                <div id="growth-container"></div>

                <div class="admin-quick-links" style="margin-top: 32px;">
                    <h2>Quick Links</h2>
                    <div class="quick-link-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; margin-top: 12px;">
                        ${this._quickLink('admin/users', 'fa-users', 'Users')}
                        ${this._quickLink('admin/artists', 'fa-user', 'Artists')}
                        ${this._quickLink('admin/all-songs', 'fa-headphones', 'All Songs')}
                        ${this._quickLink('admin/pending', 'fa-clock', 'Pending Songs')}
                        ${this._quickLink('admin/albums', 'fa-compact-disc', 'Albums')}
                        ${this._quickLink('admin/videos', 'fa-video', 'Videos')}
                        ${this._quickLink('admin/withdrawals', 'fa-money-bill-wave', 'Withdrawals')}
                        ${this._quickLink('admin/reports', 'fa-flag', 'Reports')}
                        ${this._quickLink('admin/comments', 'fa-comment', 'Reported Comments')}
                        ${this._quickLink('admin/settings', 'fa-cog', 'Settings')}
                    </div>
                </div>
            </div>
        `;
    }

    _quickLink(route, icon, label) {
        return `
            <button class="quick-link-card" type="button" data-nav="${this._escapeAttr(route)}"
                    style="background:rgba(108,99,255,0.05); border:1px solid rgba(108,99,255,0.2); border-radius:8px; padding:16px; cursor:pointer; text-align:left;">
                <i class="fas ${icon}" style="font-size:24px; color:#6c63ff; margin-bottom:8px;"></i>
                <div style="font-weight:bold;">${this._escapeHtml(label)}</div>
            </button>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAdmin?.()) {
            Toast.show?.('Admin access required', 'error');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('home');
            return;
        }

        this._wireQuickLinks();
        this._wireActionButtons();
        await this._loadData();
        this._renderStats();
        this._renderGrowth();
    }

    _wireQuickLinks() {
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', () => {
                const route = el.dataset.nav;
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(route);
                else window.location.hash = route;
            });
        });
    }

    _wireActionButtons() {
        document.getElementById('refresh-data-btn')?.addEventListener('click', async () => {
            await this._loadData();
            this._renderStats();
            this._renderGrowth();
            Toast.show?.('Dashboard refreshed', 'success');
        });
        document.getElementById('trigger-backup-btn')?.addEventListener('click', () => this._triggerBackup());
        document.getElementById('admin-upload-song-btn')?.addEventListener('click', () => this._showUploadSongModal());
        document.getElementById('admin-upload-video-btn')?.addEventListener('click', () => this._showUploadVideoModal());
        document.getElementById('admin-create-album-btn')?.addEventListener('click', () => this._showCreateAlbumModal());
    }

    // Data loading
    async _loadData() {
        const [analyticsResult, revenueResult, pendingResult] = await Promise.all([
            this.adminAPI.getPlatformAnalytics().catch(() => null),
            this.adminAPI.getRevenueAnalytics().catch(() => null),
            this.adminAPI.getPendingSongs().catch(() => null)
        ]);

        this.analytics = analyticsResult?.success ? analyticsResult.data : null;
        this.revenueAnalytics = revenueResult?.success ? revenueResult.data : null;
        const pending = pendingResult?.success ? pendingResult.data : null;
        this.pendingCount = Array.isArray(pending) ? pending.length : (pending?.songs?.length || 0);
        this.loading = false;
    }

    _renderStats() {
        const container = document.getElementById('admin-stats-container');
        if (!container) return;

        const overview = this.analytics?.overview || {};
        const totalRevenue = Number(overview.totalRevenue || 0);
        const commission = Number(overview.platformCommission || 0);

        container.innerHTML = `
            <div class="dashboard-stats">
                <div class="stat-card"><h3>Total Users</h3><div class="value">${this._formatNumber(overview.totalUsers || 0)}</div></div>
                <div class="stat-card"><h3>Total Artists</h3><div class="value">${this._formatNumber(overview.totalArtists || 0)}</div></div>
                <div class="stat-card"><h3>Total Songs</h3><div class="value">${this._formatNumber(overview.totalSongs || 0)}</div></div>
                <div class="stat-card"><h3>Total Albums</h3><div class="value">${this._formatNumber(overview.totalAlbums || 0)}</div></div>
                <div class="stat-card"><h3>Pending Songs</h3><div class="value">${this.pendingCount}</div></div>
                <div class="stat-card"><h3>Total Revenue</h3><div class="value">K${totalRevenue.toLocaleString()}</div></div>
                <div class="stat-card"><h3>Platform Commission</h3><div class="value">K${commission.toLocaleString()}</div></div>
            </div>
        `;
    }

    _renderGrowth() {
        const container = document.getElementById('growth-container');
        if (!container) return;
        const growth = this.analytics?.overview?.growth || this.analytics?.growth || {};
        const newUsers = growth.newUsersLast30Days || 0;
        const newSongs = growth.newSongsLast30Days || 0;
        container.innerHTML = `
            <div class="growth-stats" style="background:rgba(108,99,255,0.05); padding:16px; border-radius:8px;">
                <h3>Growth (Last 30 Days)</h3>
                <div class="stats-row" style="display:flex; gap:24px; margin-top:8px;">
                    <span>📈 New Users: <strong>${this._formatNumber(newUsers)}</strong></span>
                    <span>🎵 New Songs: <strong>${this._formatNumber(newSongs)}</strong></span>
                </div>
            </div>
        `;
    }

    // Backup
    async _triggerBackup() {
        const btn = document.getElementById('trigger-backup-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Backing up...';
        }
        const result = await this.adminAPI.triggerBackup();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-database"></i> Trigger Backup';
        }
        if (result.success) {
            Toast.show?.('Backup triggered successfully', 'success');
        } else {
            Toast.show?.(result.error || 'Backup failed', 'error');
        }
    }

    // Upload modals
    async _loadArtistOptions() {
        const result = await this.adminAPI.getAllArtistsForAdmin();
        const artists = result.success
            ? (result.data?.artists || result.data || [])
            : [];
        // Pre-escape both id and stageName for safe option building.
        return artists.map(a => ({
            id: this._escapeAttr(a._id),
            name: this._escapeHtml(a.stageName || a.displayName || 'Unknown')
        }));
    }

    _genres() {
        return Array.isArray(window.GENRES) && window.GENRES.length > 0
            ? window.GENRES
            : ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel',
               'Traditional', 'Amapiano', 'Cuundu', 'Soul', 'Rock', 'Kalindula', 'Other'];
    }

    async _showUploadSongModal() {
        const artistOptions = await this._loadArtistOptions();
        const genres = this._genres();
        const genreOpts = genres.map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`).join('');
        const artistOpts = artistOptions.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        const handle = Modal.show({
            title: 'Admin Upload Song',
            content: `
                <form id="aus-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="aus-audio">Audio File *</label>
                        <input type="file" id="aus-audio" accept="audio/*" required>
                    </div>
                    <div class="form-group">
                        <label for="aus-cover">Cover Art (max 5MB)</label>
                        <input type="file" id="aus-cover" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label for="aus-title">Song Title *</label>
                        <input type="text" id="aus-title" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="aus-genre">Genre *</label>
                        <select id="aus-genre" required>${genreOpts}</select>
                    </div>
                    <div class="form-group">
                        <label for="aus-artist">Artist *</label>
                        <select id="aus-artist" required>
                            <option value="">Select Artist</option>
                            ${artistOpts || '<option value="" disabled>No artists found</option>'}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="aus-premium"> Premium content
                        </label>
                    </div>
                    <div class="form-group" id="aus-price-group" hidden>
                        <label for="aus-price">Price (Kwacha)</label>
                        <input type="number" id="aus-price" min="0" step="0.01" value="0">
                    </div>
                    <div class="form-group">
                        <label for="aus-tags">Tags (comma-separated)</label>
                        <input type="text" id="aus-tags" placeholder="afrobeat, zambian, new" maxlength="200">
                    </div>
                    <div class="form-group">
                        <label for="aus-lyrics">Lyrics</label>
                        <textarea id="aus-lyrics" rows="4" maxlength="5000"></textarea>
                    </div>
                    <div id="aus-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Upload Song', class: 'btn-primary', action: 'upload' }
            ]
        });

        requestAnimationFrame(() => {
            const premiumCb = document.getElementById('aus-premium');
            const priceGroup = document.getElementById('aus-price-group');
            premiumCb?.addEventListener('change', () => {
                if (priceGroup) priceGroup.hidden = !premiumCb.checked;
            });

            const uploadBtn = handle?.element?.querySelector('[data-action="upload"]');
            uploadBtn?.addEventListener('click', async (e) => {
                // stopImmediatePropagation prevents Modal.js's default
                // click handler (which closes the modal) from firing on
                // the same element. Without this, the modal closes
                // before _submitUploadSong runs and the form fields
                // become unreachable.
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                await this._submitUploadSong(handle);
            }, true);   // capture phase — run before any bubble handler
        });
    }

    async _submitUploadSong(handle) {
        // Read all form values FIRST while we know the modal is still in
        // the DOM. After this point we don't depend on the form existing.
        const get = (id) => document.getElementById(id);
        const audio = get('aus-audio')?.files?.[0];
        const cover = get('aus-cover')?.files?.[0];
        const title = get('aus-title')?.value.trim() || '';
        const genre = get('aus-genre')?.value || '';
        const artistId = get('aus-artist')?.value || '';
        const isPremium = !!get('aus-premium')?.checked;
        const price = parseFloat(get('aus-price')?.value || '0');
        const tagsRaw = get('aus-tags')?.value.trim() || '';
        const lyrics = get('aus-lyrics')?.value.trim() || '';

        // Error display — falls back to Toast if the inline element
        // is gone (e.g., modal already closed itself).
        const showError = (msg) => {
            const el = get('aus-error');
            if (el) el.textContent = msg;
            else if (msg) Toast.show?.(msg, 'error');
        };
        showError('');

        if (!audio) { showError('Audio file is required'); return; }
        if (!title) { showError('Title is required'); return; }
        if (!artistId) { showError('Select an artist'); return; }
        if (cover && cover.size > 5 * 1024 * 1024) {
            showError('Cover must be 5MB or less');
            return;
        }
        if (audio.size > 20 * 1024 * 1024) {
            showError('Audio file must be 20MB or less');
            return;
        }

        const formData = new FormData();
        formData.append('audio', audio);
        if (cover) formData.append('coverArt', cover);
        formData.append('title', title);
        formData.append('genre', genre);
        formData.append('artistId', artistId);
        if (isPremium) {
            formData.append('isPremium', 'true');
            if (Number.isFinite(price) && price > 0) formData.append('price', String(price));
        }
        if (tagsRaw) {
            // Split on commas, trim, drop empties.
            const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
            tags.forEach(t => formData.append('tags', t));
        }
        if (lyrics) formData.append('lyrics', lyrics);

        const submitBtn = handle?.element?.querySelector('[data-action="upload"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';
        }

        const result = await this.adminAPI.adminUploadSong(formData);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Song';
        }

        if (!result.success) {
            showError(result.error || 'Upload failed');
            return;
        }

        handle?.close?.();
        Toast.show?.('Song uploaded', 'success');
        await this._loadData();
        this._renderStats();
    }

    async _showUploadVideoModal() {
        const artistOptions = await this._loadArtistOptions();
        const genres = this._genres();
        const genreOpts = genres.map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`).join('');
        const artistOpts = artistOptions.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        const handle = Modal.show({
            title: 'Admin Upload Video',
            content: `
                <form id="auv-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="auv-video">Video File *</label>
                        <input type="file" id="auv-video" accept="video/*" required>
                    </div>
                    <div class="form-group">
                        <label for="auv-thumbnail">Thumbnail (Cover Art)</label>
                        <input type="file" id="auv-thumbnail" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label for="auv-title">Title *</label>
                        <input type="text" id="auv-title" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="auv-genre">Genre *</label>
                        <select id="auv-genre" required>${genreOpts}</select>
                    </div>
                    <div class="form-group">
                        <label for="auv-artist">Artist *</label>
                        <select id="auv-artist" required>
                            <option value="">Select Artist</option>
                            ${artistOpts || '<option value="" disabled>No artists found</option>'}
                        </select>
                    </div>
                    <div id="auv-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Upload Video', class: 'btn-primary', action: 'upload' }
            ]
        });

        requestAnimationFrame(() => {
            const uploadBtn = handle?.element?.querySelector('[data-action="upload"]');
            uploadBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Read all form values FIRST while modal is in DOM
                const get = (id) => document.getElementById(id);
                const video = get('auv-video')?.files?.[0];
                const thumbnail = get('auv-thumbnail')?.files?.[0];
                const title = get('auv-title')?.value.trim() || '';
                const genre = get('auv-genre')?.value || '';
                const artistId = get('auv-artist')?.value || '';

                const showError = (msg) => {
                    const el = get('auv-error');
                    if (el) el.textContent = msg;
                    else if (msg) Toast.show?.(msg, 'error');
                };
                showError('');

                if (!video) { showError('Video file is required'); return; }
                if (!title) { showError('Title is required'); return; }
                if (!artistId) { showError('Select an artist'); return; }
                // Video size limits handled server-side; we don't impose a client cap here.

                const fd = new FormData();
                fd.append('video', video);
                if (thumbnail) fd.append('coverArt', thumbnail);
                fd.append('title', title);
                fd.append('genre', genre);
                fd.append('artistId', artistId);

                uploadBtn.disabled = true;
                uploadBtn.textContent = 'Uploading...';

                const result = await this.adminAPI.adminUploadVideo(fd);

                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Video';

                if (!result.success) {
                    showError(result.error || 'Upload failed');
                    return;
                }
                handle?.close?.();
                Toast.show?.('Video uploaded', 'success');
                await this._loadData();
                this._renderStats();
            }, true);
        });
    }

    async _showCreateAlbumModal() {
        const artistOptions = await this._loadArtistOptions();
        const genres = this._genres();
        const genreOpts = genres.map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`).join('');
        const artistOpts = artistOptions.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        const handle = Modal.show({
            title: 'Admin Create Album',
            content: `
                <form id="aca-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="aca-title">Title *</label>
                        <input type="text" id="aca-title" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="aca-cover">Cover Art *</label>
                        <input type="file" id="aca-cover" accept="image/*" required>
                    </div>
                    <div class="form-group">
                        <label for="aca-artist">Artist *</label>
                        <select id="aca-artist" required>
                            <option value="">Select Artist</option>
                            ${artistOpts || '<option value="" disabled>No artists found</option>'}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="aca-genre">Genre</label>
                        <select id="aca-genre"><option value="">Select Genre</option>${genreOpts}</select>
                    </div>
                    <div class="form-group">
                        <label for="aca-type">Type</label>
                        <select id="aca-type">
                            <option value="album">Album</option>
                            <option value="ep">EP</option>
                            <option value="single">Single</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="aca-description">Description</label>
                        <textarea id="aca-description" rows="3" maxlength="1000"></textarea>
                    </div>
                    <div id="aca-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Create Album', class: 'btn-primary', action: 'create' }
            ]
        });

        requestAnimationFrame(() => {
            const createBtn = handle?.element?.querySelector('[data-action="create"]');
            createBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const get = (id) => document.getElementById(id);
                const title = get('aca-title')?.value.trim() || '';
                const cover = get('aca-cover')?.files?.[0];
                const artistId = get('aca-artist')?.value || '';
                const genre = get('aca-genre')?.value || '';
                const type = get('aca-type')?.value || '';
                const description = get('aca-description')?.value.trim() || '';

                const showError = (msg) => {
                    const el = get('aca-error');
                    if (el) el.textContent = msg;
                    else if (msg) Toast.show?.(msg, 'error');
                };
                showError('');

                if (!title) { showError('Title is required'); return; }
                if (!cover) { showError('Cover art is required'); return; }
                if (!artistId) { showError('Select an artist'); return; }
                if (cover.size > 5 * 1024 * 1024) {
                    showError('Cover must be 5MB or less');
                    return;
                }

                const fd = new FormData();
                fd.append('title', title);
                fd.append('coverArt', cover);
                fd.append('artistId', artistId);
                if (genre) fd.append('genre', genre);
                if (type) fd.append('type', type);
                if (description) fd.append('description', description);

                createBtn.disabled = true;
                createBtn.textContent = 'Creating...';

                const result = await this.adminAPI.adminUploadAlbum(fd);

                createBtn.disabled = false;
                createBtn.textContent = 'Create Album';

                if (!result.success) {
                    showError(result.error || 'Create failed');
                    return;
                }
                handle?.close?.();
                Toast.show?.('Album created', 'success');
                await this._loadData();
                this._renderStats();
            }, true);
        });
    }

    // Helpers
    _formatNumber(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
        return String(num || 0);
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    _escapeAttr(text) {
        return this._escapeHtml(text);
    }
}

window.AdminDashboardPage = AdminDashboardPage;
