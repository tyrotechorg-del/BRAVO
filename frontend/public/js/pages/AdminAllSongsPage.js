

class AdminAllSongsPage {
    constructor() {
        this.songs = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = { search: '', status: '', genre: '', sortBy: 'createdAt', sortOrder: 'desc' };
        this.selectedIds = new Set();
        this.adminAPI = new AdminAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
    }

    _genres() {
        return Array.isArray(window.GENRES) && window.GENRES.length > 0
            ? window.GENRES
            : ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel',
               'Traditional', 'Amapiano', 'Cuundu', 'Soul', 'Rock', 'Kalindula', 'Other'];
    }

    async render() {
        const genreOpts = this._genres()
            .map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`)
            .join('');
        return `
            <div class="admin-songs-all-page">
                <div class="page-header">
                    <h1><i class="fas fa-headphones"></i> All Songs</h1>
                    <p>View, filter, and bulk-manage all songs on the platform.</p>
                </div>

                <div class="filters-bar" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                    <input type="text" id="as-search" placeholder="Search title..." style="flex:1; min-width:200px;">
                    <select id="as-status">
                        <option value="">All Statuses</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select id="as-genre">
                        <option value="">All Genres</option>
                        ${genreOpts}
                    </select>
                    <select id="as-sort">
                        <option value="createdAt-desc">Newest</option>
                        <option value="createdAt-asc">Oldest</option>
                        <option value="playCount-desc">Most Played</option>
                        <option value="likeCount-desc">Most Liked</option>
                    </select>
                    <button class="btn-secondary" type="button" id="as-apply-btn">
                        <i class="fas fa-filter"></i> Apply
                    </button>
                </div>

                <div id="as-bulk-bar" hidden style="background:rgba(108,99,255,0.1); padding:12px; border-radius:6px; margin-bottom:12px; display:flex; gap:8px; align-items:center;">
                    <strong><span id="as-selected-count">0</span> selected</strong>
                    <button class="btn-success btn-sm" type="button" id="as-bulk-approve">Approve</button>
                    <button class="btn-danger btn-sm" type="button" id="as-bulk-reject">Reject</button>
                    <button class="btn-danger btn-sm" type="button" id="as-bulk-delete">Delete</button>
                    <button class="btn-outline btn-sm" type="button" id="as-clear-selection">Clear</button>
                </div>

                <div class="songs-table-container" id="as-container" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div class="pagination" id="as-pagination"></div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAdmin?.()) {
            Toast.show?.('Admin access required', 'error');
            return;
        }
        this._wireFilters();
        this._wireBulkBar();
        await this._loadAndRender();
    }

    _wireFilters() {
        const apply = async () => {
            const s = document.getElementById('as-search');
            const st = document.getElementById('as-status');
            const g = document.getElementById('as-genre');
            const sort = document.getElementById('as-sort');
            const [sortBy, sortOrder] = (sort?.value || 'createdAt-desc').split('-');
            this.filters = {
                search: s?.value.trim() || '',
                status: st?.value || '',
                genre: g?.value || '',
                sortBy,
                sortOrder
            };
            this.currentPage = 1;
            this.selectedIds.clear();
            this._renderBulkBar();
            await this._loadAndRender();
        };
        document.getElementById('as-apply-btn')?.addEventListener('click', apply);
        document.getElementById('as-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') apply();
        });
    }

    _wireBulkBar() {
        document.getElementById('as-bulk-approve')?.addEventListener('click', () => this._bulkAction('approve'));
        document.getElementById('as-bulk-reject')?.addEventListener('click', () => this._bulkAction('reject'));
        document.getElementById('as-bulk-delete')?.addEventListener('click', () => this._bulkAction('delete'));
        document.getElementById('as-clear-selection')?.addEventListener('click', () => {
            this.selectedIds.clear();
            this._renderTable();
            this._renderBulkBar();
        });
    }

    async _loadAndRender() {
        const result = await this.adminAPI.getAllSongsForAdmin({
            page: this.currentPage,
            limit: 50,
            ...this.filters
        });
        if (result.success) {
            const data = result.data || {};
            this.songs = data.songs || [];
            this.totalPages = data.totalPages || 1;
        } else {
            this.songs = [];
            this.totalPages = 1;
        }
        this._renderTable();
        this._renderPagination();
    }

    _renderTable() {
        const container = document.getElementById('as-container');
        if (!container) return;

        if (this.songs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <h3>No songs found</h3>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="as-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="as-select-all"></th>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Genre</th>
                        <th>Status</th>
                        <th>Plays</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="as-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('as-tbody');
        this.songs.forEach(s => tbody.appendChild(this._buildRow(s)));

        document.getElementById('as-select-all')?.addEventListener('change', (e) => {
            const checked = e.target.checked;
            this.songs.forEach(s => {
                if (checked) this.selectedIds.add(s._id);
                else this.selectedIds.delete(s._id);
            });
            this._renderTable();
            this._renderBulkBar();
        });

        document.getElementById('as-table')?.addEventListener('click', (e) => {
            const row = e.target.closest('[data-song-id]');
            if (!row) return;
            const songId = row.dataset.songId;
            const checkbox = e.target.closest('input[type="checkbox"][data-action="select"]');
            const btn = e.target.closest('[data-action]:not(input)');

            if (checkbox) {
                if (checkbox.checked) this.selectedIds.add(songId);
                else this.selectedIds.delete(songId);
                this._renderBulkBar();
                return;
            }
            if (!btn || btn.disabled) return;
            const song = this.songs.find(s => String(s._id) === String(songId));
            if (!song) return;
            if (btn.dataset.action === 'delete') this._deleteSong(song, row);
            else if (btn.dataset.action === 'approve') this._approveSong(song, row);
            else if (btn.dataset.action === 'reject') this._rejectSong(song, row);
        });
    }

    _buildRow(song) {
        const safeTitle = this._escapeHtml(song.title || 'Untitled');
        const safeArtist = this._escapeHtml(song.artist?.stageName || 'Unknown');
        const safeGenre = this._escapeHtml(song.genre || 'Various');
        const status = String(song.status || 'pending');
        const safeStatus = this._escapeHtml(status);
        const isChecked = this.selectedIds.has(song._id);

        const tr = document.createElement('tr');
        tr.setAttribute('data-song-id', song._id);
        tr.innerHTML = `
            <td><input type="checkbox" data-action="select" ${isChecked ? 'checked' : ''}></td>
            <td><strong>${safeTitle}</strong></td>
            <td>${safeArtist}</td>
            <td><span class="genre-badge">${safeGenre}</span></td>
            <td><span class="status-badge status-${safeStatus}">${safeStatus}</span></td>
            <td>${this._formatNumber(song.playCount || 0)}</td>
            <td class="actions-cell">
                ${status === 'pending' ? `
                    <button class="btn-success btn-sm" type="button" data-action="approve" aria-label="Approve">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-danger btn-sm" type="button" data-action="reject" aria-label="Reject">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
                <button class="btn-danger btn-sm" type="button" data-action="delete" aria-label="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        return tr;
    }

    _renderBulkBar() {
        const bar = document.getElementById('as-bulk-bar');
        const count = document.getElementById('as-selected-count');
        if (count) count.textContent = String(this.selectedIds.size);
        if (bar) bar.hidden = this.selectedIds.size === 0;
    }

    _renderPagination() {
        const container = document.getElementById('as-pagination');
        if (!container || this.totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        const prevDis = this.currentPage <= 1;
        const nextDis = this.currentPage >= this.totalPages;
        container.innerHTML = `
            <div class="pagination-controls">
                <button class="page-btn" type="button" data-action="prev" ${prevDis ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>
                <button class="page-btn" type="button" data-action="next" ${nextDis ? 'disabled' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            if (btn.dataset.action === 'prev' && this.currentPage > 1) this.currentPage--;
            else if (btn.dataset.action === 'next' && this.currentPage < this.totalPages) this.currentPage++;
            else return;
            await this._loadAndRender();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
    }

    async _bulkAction(action) {
        if (this.selectedIds.size === 0) return;
        if (this.selectedIds.size > 500) {
            Toast.show?.('Cannot process more than 500 at once', 'warning');
            return;
        }
        const ids = Array.from(this.selectedIds);
        const doIt = async () => {
            const result = await this.adminAPI.bulkAction(ids, action);
            if (!result.success) {
                Toast.show?.(result.error || 'Bulk action failed', 'error');
                return;
            }
            Toast.show?.(`${ids.length} song${ids.length === 1 ? '' : 's'} ${action}d`, 'success');
            this.selectedIds.clear();
            this._renderBulkBar();
            await this._loadAndRender();
        };
        if (window.Modal?.confirm) {
            Modal.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${ids.length} song${ids.length === 1 ? '' : 's'}?`, doIt);
        } else if (confirm(`${action} ${ids.length} songs?`)) {
            doIt();
        }
    }

    async _deleteSong(song, rowEl) {
        const doIt = async () => {
            const result = await this.adminAPI.deleteSong(song._id);
            if (!result.success) {
                Toast.show?.(result.error || 'Failed to delete', 'error');
                return;
            }
            this.songs = this.songs.filter(s => s._id !== song._id);
            this.selectedIds.delete(song._id);
            if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
            this._renderBulkBar();
            if (this.songs.length === 0) this._renderTable();
            Toast.show?.('Song deleted', 'success');
        };
        if (window.Modal?.confirm) {
            Modal.confirm(`Delete "${song.title}"?`, doIt);
        } else if (confirm(`Delete "${song.title}"?`)) {
            doIt();
        }
    }

    async _approveSong(song, rowEl) {
        const result = await this.adminAPI.approveSong(song._id);
        if (!result.success) {
            Toast.show?.(result.error || 'Approval failed', 'error');
            return;
        }
        song.status = 'approved';
        const newRow = this._buildRow(song);
        rowEl.parentNode.replaceChild(newRow, rowEl);
        Toast.show?.(`Approved "${song.title}"`, 'success');
    }

    async _rejectSong(song, rowEl) {
        // For bulk page, use a quick prompt-like flow via Modal
        const handle = Modal.show({
            title: 'Reject Song',
            content: `
                <p>Reject <strong>${this._escapeHtml(song.title || '')}</strong>?</p>
                <form id="ars-form">
                    <div class="form-group">
                        <label for="ars-reason">Reason</label>
                        <textarea id="ars-reason" rows="2" maxlength="500" required></textarea>
                    </div>
                    <div id="ars-error" style="color:#ff4757; font-size:14px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Reject', class: 'btn-danger', action: 'reject' }
            ]
        });
        requestAnimationFrame(() => {
            handle?.element?.querySelector('[data-action="reject"]')?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const reason = document.getElementById('ars-reason').value.trim();
                if (reason.length < 5) {
                    document.getElementById('ars-error').textContent = 'Reason must be 5+ chars';
                    return;
                }
                const result = await this.adminAPI.rejectSong(song._id, reason);
                if (!result.success) {
                    document.getElementById('ars-error').textContent = result.error || 'Failed';
                    return;
                }
                handle?.close?.();
                song.status = 'rejected';
                const newRow = this._buildRow(song);
                rowEl.parentNode.replaceChild(newRow, rowEl);
                Toast.show?.('Song rejected', 'info');
            });
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

window.AdminAllSongsPage = AdminAllSongsPage;
