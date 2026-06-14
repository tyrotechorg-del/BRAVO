

class AdminArtistsPage {
    constructor() {
        this.artists = [];
        this.searchTerm = '';
        this.adminAPI = new AdminAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
    }

    async render() {
        return `
            <div class="admin-artists-page">
                <div class="page-header">
                    <h1><i class="fas fa-user"></i> Artists</h1>
                    <p>View, verify, and manage all artists.</p>
                </div>

                <div class="filters-bar" style="display:flex; gap:8px; margin-bottom:16px;">
                    <input type="text" id="aa-search" placeholder="Search stage name..." style="flex:1; min-width:200px;">
                    <button class="btn-secondary" type="button" id="aa-search-btn"><i class="fas fa-search"></i> Search</button>
                    <button class="btn-outline" type="button" id="aa-refresh-btn"><i class="fas fa-sync-alt"></i> Refresh</button>
                </div>

                <div class="artists-stats" id="aa-stats" style="display:flex; gap:12px; margin-bottom:16px;">
                    <div class="stat-card-sm"><div class="stat-value" id="aa-stat-total">—</div><div class="stat-label">Total</div></div>
                    <div class="stat-card-sm verified"><div class="stat-value" id="aa-stat-verified">—</div><div class="stat-label">Verified</div></div>
                    <div class="stat-card-sm featured"><div class="stat-value" id="aa-stat-featured">—</div><div class="stat-label">Featured</div></div>
                </div>

                <div class="artists-table-container" id="aa-container" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAdmin?.()) {
            Toast.show?.('Admin access required', 'error');
            return;
        }
        const searchInput = document.getElementById('aa-search');
        if (searchInput) searchInput.value = this.searchTerm;

        const doSearch = async () => {
            this.searchTerm = searchInput?.value.trim() || '';
            await this._loadAndRender();
        };
        document.getElementById('aa-search-btn')?.addEventListener('click', doSearch);
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doSearch();
        });
        document.getElementById('aa-refresh-btn')?.addEventListener('click', async () => {
            await this._loadAndRender();
            Toast.show?.('Refreshed', 'success');
        });

        await this._loadAndRender();
    }

    async _loadAndRender() {
        const result = await this.adminAPI.getAllArtistsForAdmin(this.searchTerm);
        if (result.success) {
            const data = result.data;
            this.artists = Array.isArray(data) ? data : (data?.artists || []);
        } else {
            this.artists = [];
        }
        this._renderStats();
        this._renderTable();
    }

    _renderStats() {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
        set('aa-stat-total', this.artists.length);
        set('aa-stat-verified', this.artists.filter(a => a.verified).length);
        set('aa-stat-featured', this.artists.filter(a => a.featured).length);
    }

    _renderTable() {
        const container = document.getElementById('aa-container');
        if (!container) return;

        if (this.artists.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user"></i>
                    <h3>No artists found</h3>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="aa-table">
                <thead>
                    <tr>
                        <th>Avatar</th>
                        <th>Stage Name</th>
                        <th>User</th>
                        <th>Songs</th>
                        <th>Monthly Listeners</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="aa-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('aa-tbody');
        this.artists.forEach(a => tbody.appendChild(this._buildRow(a)));

        document.getElementById('aa-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-artist-id]');
            if (!row) return;
            const artist = this.artists.find(a => String(a._id) === String(row.dataset.artistId));
            if (!artist) return;
            const action = btn.dataset.action;
            if (action === 'verify') this._toggleVerify(artist, row);
            else if (action === 'feature') this._toggleFeature(artist, row);
            else if (action === 'view') this._viewArtist(artist);
        });
    }

    _buildRow(a) {
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const safeStage = this._escapeHtml(a.stageName || 'Unknown');
        const safeUsername = this._escapeHtml(a.userId?.username || a.user?.username || '—');
        const safeEmail = this._escapeHtml(a.userId?.email || a.user?.email || '');
        const songCount = a.songCount || a.totalSongs || 0;
        const monthly = a.monthlyListeners || 0;

        const tr = document.createElement('tr');
        tr.setAttribute('data-artist-id', a._id);
        tr.innerHTML = `
            <td><img class="artist-avatar-sm" alt="${safeStage}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;"></td>
            <td><strong>${safeStage}</strong></td>
            <td>${safeUsername}<br><small>${safeEmail}</small></td>
            <td>${this._formatNumber(songCount)}</td>
            <td>${this._formatNumber(monthly)}</td>
            <td>
                ${a.verified ? '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Verified</span>' : ''}
                ${a.featured ? '<span class="badge badge-warning"><i class="fas fa-star"></i> Featured</span>' : ''}
                ${!a.verified && !a.featured ? '<span class="badge">—</span>' : ''}
            </td>
            <td class="actions-cell">
                <button class="btn-sm ${a.verified ? 'btn-outline' : 'btn-success'}" type="button" data-action="verify">
                    <i class="fas fa-check-circle"></i> ${a.verified ? 'Unverify' : 'Verify'}
                </button>
                <button class="btn-sm ${a.featured ? 'btn-outline' : 'btn-primary'}" type="button" data-action="feature">
                    <i class="fas fa-star"></i> ${a.featured ? 'Un-feature' : 'Feature'}
                </button>
                <button class="btn-icon" type="button" data-action="view" aria-label="View profile">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;

        const img = tr.querySelector('.artist-avatar-sm');
        if (img) {
            img.src = this._safeAvatarUrl(a.avatar || a.userId?.avatar) || fallback;
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }
        return tr;
    }

    async _toggleVerify(artist, rowEl) {
        const wasVerified = !!artist.verified;
        const result = wasVerified
            ? await this.adminAPI.unverifyArtist(artist._id)
            : await this.adminAPI.verifyArtist(artist._id);
        if (!result.success) {
            Toast.show?.(result.error || 'Action failed', 'error');
            return;
        }
        artist.verified = !wasVerified;
        this._refreshRow(artist._id);
        this._renderStats();
        Toast.show?.(wasVerified ? 'Artist unverified' : 'Artist verified', 'success');
    }

    async _toggleFeature(artist, rowEl) {
        const newFeatured = !artist.featured;
        const result = await this.adminAPI.featureArtist(artist._id, newFeatured);
        if (!result.success) {
            Toast.show?.(result.error || 'Action failed', 'error');
            return;
        }
        artist.featured = newFeatured;
        this._refreshRow(artist._id);
        this._renderStats();
        Toast.show?.(newFeatured ? 'Artist featured' : 'Artist un-featured', 'success');
    }

    _refreshRow(artistId) {
        const oldRow = document.querySelector(`[data-artist-id="${artistId}"]`);
        if (!oldRow) return;
        const artist = this.artists.find(a => String(a._id) === String(artistId));
        if (!artist) return;
        const newRow = this._buildRow(artist);
        oldRow.parentNode.replaceChild(newRow, oldRow);
    }

    _viewArtist(artist) {
        if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(`artist/${artist._id}`);
        else window.location.hash = `artist/${artist._id}`;
    }

    _safeAvatarUrl(url) {
        if (!url || typeof url !== 'string') return null;
        if (/^javascript:/i.test(url) || /^data:text/i.test(url)) return null;
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${this.staticUrl}${url}`;
        }
        return url;
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
}

window.AdminArtistsPage = AdminArtistsPage;
