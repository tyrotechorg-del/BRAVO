

class ArtistDashboardPage {
    constructor() {
        this.stats = {
            totalStreams: 0,
            totalDownloads: 0,
            totalRevenue: 0,
            monthlyListeners: 0,
            totalSongs: 0
        };
        this.recentSongs = [];
        this.artist = null;
        this.showEditProfile = false;
        this.loading = true;
    }

    async render() {
        return `
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h1>Artist Dashboard</h1>
                    <button class="btn-outline" type="button" id="edit-profile-btn">
                        <i class="fas fa-edit"></i> Edit Profile
                    </button>
                </div>

                <div id="edit-profile-pane" hidden></div>

                <div class="dashboard-stats">
                    <div class="stat-card">
                        <h3>Total Streams</h3>
                        <div class="value" id="stat-streams">—</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Revenue</h3>
                        <div class="value" id="stat-revenue">—</div>
                    </div>
                    <div class="stat-card">
                        <h3>Monthly Listeners</h3>
                        <div class="value" id="stat-listeners">—</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Songs</h3>
                        <div class="value" id="stat-songs">—</div>
                    </div>
                </div>

                <div id="subscription-alert-container"></div>

                <div class="dashboard-section">
                    <h2>Your Songs</h2>
                    <div class="songs-grid" id="artist-songs-grid">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>
                </div>

                <div class="dashboard-actions">
                    <button class="btn-primary" type="button" data-nav="upload">
                        <i class="fas fa-upload"></i> Upload New Song
                    </button>
                    <button class="btn-outline" type="button" data-nav="earnings">
                        <i class="fas fa-wallet"></i> View Earnings
                    </button>
                    <button class="btn-outline" type="button" data-nav="artist/albums">
                        <i class="fas fa-compact-disc"></i> Manage Albums
                    </button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        this._wireNavButtons();
        document.getElementById('edit-profile-btn')?.addEventListener('click', () => this._toggleEditProfile());
        await this._loadData();
        this._renderStats();
        this._renderSubscriptionAlert();
        this._renderSongs();
    }

    _wireNavButtons() {
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', () => {
                const dest = el.dataset.nav;
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(dest);
                else window.location.hash = dest;
            });
        });
    }

    async _loadData() {
        try {
            const artistsAPI = new ArtistsAPI();
            const result = await artistsAPI.getDashboard();
            const data = result?.success ? result.data : result;
            if (data) {
                this.artist = data.artist || null;
                this.stats = data.stats || this.stats;
                this.recentSongs = data.recentSongs || data.songs || [];
            }
        } catch (err) {
            console.error('Load dashboard error:', err);
        }
        this.loading = false;
    }

    _renderStats() {
        const el = (id) => document.getElementById(id);
        if (el('stat-streams')) el('stat-streams').textContent = this._formatNumber(this.stats.totalStreams || 0);
        if (el('stat-revenue')) el('stat-revenue').textContent = `K${Number(this.stats.totalRevenue || 0).toFixed(2)}`;
        if (el('stat-listeners')) el('stat-listeners').textContent = this._formatNumber(this.stats.monthlyListeners || 0);
        if (el('stat-songs')) el('stat-songs').textContent = String(this.stats.totalSongs || this.recentSongs.length || 0);
    }

    _renderSubscriptionAlert() {
        const container = document.getElementById('subscription-alert-container');
        if (!container) return;
        if (this.artist?.subscriptionStatus === 'inactive') {
            container.innerHTML = `
                <div class="subscription-alert">
                    <i class="fas fa-crown"></i>
                    <div class="alert-content">
                        <strong>Upgrade to Pro</strong>
                        <p>Get unlimited uploads, advanced analytics, and monetization features.</p>
                    </div>
                    <button class="btn-primary" type="button" id="upgrade-btn">Upgrade Now</button>
                </div>
            `;
            document.getElementById('upgrade-btn')?.addEventListener('click', () => {
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('subscriptions');
                else window.location.hash = 'subscriptions';
            });
        } else {
            container.innerHTML = '';
        }
    }

    _renderSongs() {
        const grid = document.getElementById('artist-songs-grid');
        if (!grid) return;

        if (this.recentSongs.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <h3>No songs yet</h3>
                    <p>Upload your first song to get started.</p>
                    <button class="btn-primary" type="button" id="dash-upload-btn">Upload</button>
                </div>
            `;
            document.getElementById('dash-upload-btn')?.addEventListener('click', () => {
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('upload');
                else window.location.hash = 'upload';
            });
            return;
        }

        grid.innerHTML = '';
        this.recentSongs.forEach(song => {
            // Render with SongCard then add an artist-specific delete button.
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            new SongCard(song, wrapper, { playlist: this.recentSongs, hideDownload: true });

            // Add delete button overlaid on the card.
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-icon artist-delete-btn';
            delBtn.type = 'button';
            delBtn.title = 'Delete song';
            delBtn.setAttribute('aria-label', 'Delete song');
            delBtn.style.cssText = 'position:absolute; top:8px; right:8px; background:rgba(255,71,87,0.9); color:#fff; border:none; border-radius:50%; width:32px; height:32px; cursor:pointer; z-index:5;';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteSong(song, wrapper);
            });
            wrapper.appendChild(delBtn);

            grid.appendChild(wrapper);
        });

        // Status badges as a separate row under each card
        this.recentSongs.forEach((song, idx) => {
            const card = grid.children[idx]?.querySelector('.song-card');
            if (!card) return;
            const stats = card.querySelector('.song-stats');
            if (!stats) return;
            const status = song.status || 'pending';
            const cls = status === 'approved' ? 'badge-success' : status === 'rejected' ? 'badge-danger' : 'badge-warning';
            const badge = document.createElement('span');
            badge.className = `badge ${cls}`;
            badge.textContent = status;
            stats.appendChild(badge);
        });
    }

    _deleteSong(song, cardEl) {
        const doDelete = async () => {
            const songsAPI = new SongsAPI();
            const result = await songsAPI.deleteSong(song._id);
            // Accept either { success } shape OR a raw response.
            if (result && (result.success === false || result.error)) {
                Toast.show?.(result.error || 'Failed to delete song', 'error');
                return;
            }
            this.recentSongs = this.recentSongs.filter(s => s._id !== song._id);
            if (cardEl?.parentNode) cardEl.parentNode.removeChild(cardEl);
            Toast.show?.('Song deleted', 'success');
            if (this.recentSongs.length === 0) this._renderSongs();
        };
        if (window.Modal?.confirm) {
            Modal.confirm(`Delete "${song.title}"? This cannot be undone.`, doDelete);
        } else if (confirm(`Delete "${song.title}"? This cannot be undone.`)) {
            doDelete();
        }
    }

    _toggleEditProfile() {
        this.showEditProfile = !this.showEditProfile;
        const pane = document.getElementById('edit-profile-pane');
        if (!pane) return;

        if (!this.showEditProfile) {
            pane.hidden = true;
            pane.innerHTML = '';
            return;
        }

        pane.hidden = false;
        pane.innerHTML = this._editProfileHTML();
        this._populateEditProfile();
        this._wireEditProfile();
    }

    _editProfileHTML() {
        const genres = Array.isArray(window.GENRES) && window.GENRES.length > 0
            ? window.GENRES
            : ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel',
               'Traditional', 'Amapiano', 'Cuundu', 'Soul', 'Rock', 'Kalindula', 'Other'];

        return `
            <div class="edit-profile-pane" style="background: rgba(108,99,255,0.05); padding: 24px; border-radius: 12px; margin-bottom: 24px;">
                <h3 style="margin-bottom: 16px;">Edit Artist Profile</h3>
                <form id="artist-profile-form">
                    <div class="form-group">
                        <label for="ap-stagename">Stage Name *</label>
                        <input type="text" id="ap-stagename" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="ap-genres">Genres</label>
                        <select id="ap-genres" multiple size="5">
                            ${genres.map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`).join('')}
                        </select>
                        <small style="color:#888;">Hold Ctrl/Cmd to select multiple</small>
                    </div>
                    <div class="form-group">
                        <label for="ap-bio">Bio</label>
                        <textarea id="ap-bio" rows="4" maxlength="1000"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="ap-website">Website</label>
                        <input type="url" id="ap-website" maxlength="200">
                    </div>
                    <div class="form-group">
                        <label for="ap-recordlabel">Record Label</label>
                        <input type="text" id="ap-recordlabel" maxlength="100">
                    </div>
                    <div id="ap-error" style="color:#ff4757; font-size:14px; margin-bottom:8px;"></div>
                    <div class="edit-profile-actions" style="display:flex; gap:8px;">
                        <button type="submit" class="btn-primary">Save Changes</button>
                        <button type="button" class="btn-secondary" id="ap-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
    }

    _populateEditProfile() {
        const a = this.artist || {};
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('ap-stagename', a.stageName);
        set('ap-bio', a.bio);
        set('ap-website', a.website);
        set('ap-recordlabel', a.recordLabel);
        // Genres: select options matching saved genres
        const genresSelect = document.getElementById('ap-genres');
        if (genresSelect && Array.isArray(a.genres)) {
            Array.from(genresSelect.options).forEach(opt => {
                opt.selected = a.genres.includes(opt.value);
            });
        }
    }

    _wireEditProfile() {
        const form = document.getElementById('artist-profile-form');
        const cancelBtn = document.getElementById('ap-cancel');
        const errorEl = document.getElementById('ap-error');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this._toggleEditProfile());
        }
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const stageName = document.getElementById('ap-stagename')?.value.trim();
            const bio = document.getElementById('ap-bio')?.value.trim();
            const website = document.getElementById('ap-website')?.value.trim();
            const recordLabel = document.getElementById('ap-recordlabel')?.value.trim();
            const genresSelect = document.getElementById('ap-genres');
            const genres = genresSelect
                ? Array.from(genresSelect.selectedOptions).map(o => o.value)
                : [];

            if (!stageName) {
                if (errorEl) errorEl.textContent = 'Stage name is required';
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            const artistsAPI = new ArtistsAPI();
            const result = await artistsAPI.updateProfile({ stageName, genres, bio, website, recordLabel });

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Changes';
            }

            if (!result.success) {
                if (errorEl) errorEl.textContent = result.error || 'Failed to save';
                return;
            }

            Toast.show?.('Profile updated', 'success');
            this.artist = { ...this.artist, stageName, genres, bio, website, recordLabel };
            this._toggleEditProfile();
        });
    }

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

window.ArtistDashboardPage = ArtistDashboardPage;
