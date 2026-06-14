

class AdminSongsPage {
    constructor() {
        this.pendingSongs = [];
        this.adminAPI = new AdminAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.processing = new Set();
    }

    async render() {
        return `
            <div class="admin-songs-page">
                <div class="page-header">
                    <h1><i class="fas fa-clock"></i> Pending Songs</h1>
                    <p>Review and approve songs uploaded by artists.</p>
                </div>
                <div class="pending-songs-container" id="ps-container" aria-live="polite">
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
        await this._loadData();
        this._renderTable();
    }

    async _loadData() {
        const result = await this.adminAPI.getPendingSongs();
        if (result.success) {
            this.pendingSongs = Array.isArray(result.data) ? result.data : (result.data?.songs || []);
        } else {
            this.pendingSongs = [];
        }
    }

    _renderTable() {
        const container = document.getElementById('ps-container');
        if (!container) return;

        if (this.pendingSongs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>No pending songs</h3>
                    <p>All caught up — every song has been reviewed.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h2>${this.pendingSongs.length} song${this.pendingSongs.length === 1 ? '' : 's'} awaiting approval</h2>
            <div class="songs-table-container">
                <table class="data-table" id="ps-table">
                    <thead>
                        <tr>
                            <th>Cover</th>
                            <th>Title</th>
                            <th>Artist</th>
                            <th>Genre</th>
                            <th>Uploaded</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="ps-tbody"></tbody>
                </table>
            </div>
        `;

        const tbody = document.getElementById('ps-tbody');
        this.pendingSongs.forEach(song => tbody.appendChild(this._buildRow(song)));

        document.getElementById('ps-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-song-id]');
            if (!row) return;
            const song = this.pendingSongs.find(s => String(s._id) === String(row.dataset.songId));
            if (!song) return;
            const action = btn.dataset.action;
            if (action === 'approve') this._approve(song, row);
            else if (action === 'reject') this._showRejectModal(song, row);
            else if (action === 'preview') this._previewSong(song);
        });
    }

    _buildRow(song) {
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const safeTitle = this._escapeHtml(song.title || 'Untitled');
        const safeArtist = this._escapeHtml(song.artist?.stageName || 'Unknown');
        const safeGenre = this._escapeHtml(song.genre || 'Various');
        const uploaded = song.createdAt ? new Date(song.createdAt).toLocaleDateString() : '—';

        const tr = document.createElement('tr');
        tr.setAttribute('data-song-id', song._id);
        tr.innerHTML = `
            <td><img class="song-cover-sm" alt="${safeTitle}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;"></td>
            <td><strong>${safeTitle}</strong></td>
            <td>${safeArtist}</td>
            <td><span class="genre-badge">${safeGenre}</span></td>
            <td>${this._escapeHtml(uploaded)}</td>
            <td class="actions-cell">
                <button class="btn-icon" type="button" data-action="preview" title="Preview" aria-label="Preview">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-success btn-sm" type="button" data-action="approve" aria-label="Approve">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-danger btn-sm" type="button" data-action="reject" aria-label="Reject">
                    <i class="fas fa-times"></i> Reject
                </button>
            </td>
        `;

        const img = tr.querySelector('.song-cover-sm');
        if (img) {
            const cover = this._safeImageUrl(song.coverArt);
            img.src = cover || fallback;
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }
        return tr;
    }

    _previewSong(song) {
        if (!window.bravoApp?.audioPlayer) {
            Toast.show?.('Player not available', 'error');
            return;
        }
        // For admins, the backend's optionalAuth + admin role check
        // should allow streaming pending songs.
        window.bravoApp.audioPlayer.loadSong(song);
    }

    async _approve(song, rowEl) {
        if (this.processing.has(song._id)) return;
        this.processing.add(song._id);
        rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);

        const result = await this.adminAPI.approveSong(song._id);
        this.processing.delete(song._id);

        if (!result.success) {
            Toast.show?.(result.error || 'Approval failed', 'error');
            rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
            return;
        }

        this.pendingSongs = this.pendingSongs.filter(s => s._id !== song._id);
        if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
        Toast.show?.(`Approved "${song.title}"`, 'success');
        if (this.pendingSongs.length === 0) this._renderTable();
    }

    _showRejectModal(song, rowEl) {
        if (this.processing.has(song._id)) return;
        const handle = Modal.show({
            title: 'Reject Song',
            content: `
                <p>Reject <strong>${this._escapeHtml(song.title || '')}</strong> by <strong>${this._escapeHtml(song.artist?.stageName || 'Unknown')}</strong>?</p>
                <form id="rs-form" novalidate>
                    <div class="form-group">
                        <label for="rs-reason">Rejection Reason *</label>
                        <textarea id="rs-reason" rows="3" maxlength="500" required></textarea>
                        <small style="color:#888;">The artist will see this. Be specific and constructive.</small>
                    </div>
                    <div id="rs-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Confirm Rejection', class: 'btn-danger', action: 'reject' }
            ]
        });

        requestAnimationFrame(() => {
            const submitBtn = handle?.element?.querySelector('[data-action="reject"]');
            submitBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const reason = document.getElementById('rs-reason').value.trim();
                const errorEl = document.getElementById('rs-error');
                if (reason.length < 5) {
                    errorEl.textContent = 'Reason must be at least 5 characters';
                    return;
                }

                this.processing.add(song._id);
                rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);
                submitBtn.disabled = true;
                submitBtn.textContent = 'Rejecting...';

                const result = await this.adminAPI.rejectSong(song._id, reason);

                this.processing.delete(song._id);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm Rejection';

                if (!result.success) {
                    errorEl.textContent = result.error || 'Rejection failed';
                    rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
                    return;
                }

                handle?.close?.();
                this.pendingSongs = this.pendingSongs.filter(s => s._id !== song._id);
                if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
                Toast.show?.(`Rejected "${song.title}"`, 'info');
                if (this.pendingSongs.length === 0) this._renderTable();
            });
        });
    }

    _safeImageUrl(url) {
        if (!url || typeof url !== 'string') return null;
        if (/^javascript:/i.test(url) || /^data:text/i.test(url)) return null;
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${this.staticUrl}${url}`;
        }
        return url;
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AdminSongsPage = AdminSongsPage;
