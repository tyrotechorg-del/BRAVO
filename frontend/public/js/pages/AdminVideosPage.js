/**
 * Admin Videos Page
 */

class AdminVideosPage {
    constructor() {
        this.videos = [];
        this.statusFilter = '';
        this.adminAPI = new AdminAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.processing = new Set();
    }

    async render() {
        return `
            <div class="admin-videos-page">
                <div class="page-header">
                    <h1><i class="fas fa-video"></i> Videos</h1>
                    <p>View and manage all video content on the platform.</p>
                </div>

                <div class="videos-stats" id="av-stats" style="display:flex; gap:12px; margin-bottom:16px;">
                    <div class="stat-card-sm"><div class="stat-value" id="av-stat-total">—</div><div class="stat-label">Total</div></div>
                    <div class="stat-card-sm approved"><div class="stat-value" id="av-stat-approved">—</div><div class="stat-label">Approved</div></div>
                    <div class="stat-card-sm pending"><div class="stat-value" id="av-stat-pending">—</div><div class="stat-label">Pending</div></div>
                </div>

                <div class="filters-bar" style="display:flex; gap:8px; margin-bottom:16px;">
                    <select id="av-status-filter">
                        <option value="">All Videos</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button class="btn-outline" type="button" id="av-refresh-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                <div class="videos-table-container" id="av-container" aria-live="polite">
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

        const filterSel = document.getElementById('av-status-filter');
        if (filterSel) filterSel.value = this.statusFilter;

        filterSel?.addEventListener('change', async () => {
            this.statusFilter = filterSel.value;
            await this._loadAndRender();
        });
        document.getElementById('av-refresh-btn')?.addEventListener('click', async () => {
            await this._loadAndRender();
            Toast.show?.('Refreshed', 'success');
        });

        await this._loadAndRender();
    }

    async _loadAndRender() {
        const result = await this.adminAPI.getAllVideos(1, 100, this.statusFilter || null);
        if (result.success) {
            const data = result.data;
            this.videos = Array.isArray(data) ? data : (data?.videos || data?.songs || []);
        } else {
            this.videos = [];
        }
        this._renderStats();
        this._renderTable();
    }

    _renderStats() {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
        set('av-stat-total', this.videos.length);
        set('av-stat-approved', this.videos.filter(v => v.status === 'approved').length);
        set('av-stat-pending', this.videos.filter(v => v.status === 'pending').length);
    }

    _renderTable() {
        const container = document.getElementById('av-container');
        if (!container) return;

        if (this.videos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-video"></i>
                    <h3>No videos found</h3>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="av-table">
                <thead>
                    <tr>
                        <th>Thumbnail</th>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Genre</th>
                        <th>Views</th>
                        <th>Status</th>
                        <th>Uploaded</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="av-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('av-tbody');
        this.videos.forEach(v => tbody.appendChild(this._buildRow(v)));

        document.getElementById('av-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-video-id]');
            if (!row) return;
            const video = this.videos.find(v => String(v._id) === String(row.dataset.videoId));
            if (!video) return;
            const action = btn.dataset.action;
            if (action === 'play') this._playVideo(video);
            else if (action === 'approve') this._approveVideo(video, row);
            else if (action === 'reject') this._showRejectModal(video, row);
            else if (action === 'delete') this._deleteVideo(video, row);
        });
    }

    _buildRow(video) {
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const safeTitle = this._escapeHtml(video.title || 'Untitled');
        const safeArtist = this._escapeHtml(video.artist?.stageName || 'Unknown');
        const safeGenre = this._escapeHtml(video.genre || 'Various');
        const status = String(video.status || 'pending');
        const safeStatus = this._escapeHtml(status);
        const uploaded = video.createdAt ? new Date(video.createdAt).toLocaleDateString() : '—';

        const tr = document.createElement('tr');
        tr.setAttribute('data-video-id', video._id);
        tr.innerHTML = `
            <td><img class="video-thumb-sm" alt="${safeTitle}" style="width:48px; height:36px; border-radius:4px; object-fit:cover;"></td>
            <td><strong>${safeTitle}</strong></td>
            <td>${safeArtist}</td>
            <td><span class="genre-badge">${safeGenre}</span></td>
            <td>${this._formatNumber(video.playCount || 0)}</td>
            <td><span class="status-badge status-${safeStatus}">${safeStatus}</span></td>
            <td>${this._escapeHtml(uploaded)}</td>
            <td class="actions-cell">
                <button class="btn-icon" type="button" data-action="play" aria-label="Play">
                    <i class="fas fa-play"></i>
                </button>
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

        const img = tr.querySelector('.video-thumb-sm');
        if (img) {
            img.src = this._safeImageUrl(video.coverArt) || fallback;
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }
        return tr;
    }

    _playVideo(video) {
        // The backend song stream endpoint handles both audio and video.
        // For admin previews, we go through the streaming route — same
        const streamUrl = `${window.API_BASE_URL}/songs/${encodeURIComponent(video._id)}/stream`;
        const safeTitle = this._escapeHtml(video.title || 'Video');

        Modal.show({
            title: safeTitle,
            content: `
                <div style="text-align:center;">
                    <video id="av-player" controls style="max-width:100%; max-height:60vh; background:black;" preload="metadata">
                        <source src="${streamUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `,
            buttons: [{ text: 'Close', class: 'btn-secondary', action: 'close' }]
        });
    }

    async _approveVideo(video, rowEl) {
        if (this.processing.has(video._id)) return;
        this.processing.add(video._id);
        rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);

        const result = await this.adminAPI.approveVideo(video._id);
        this.processing.delete(video._id);

        if (!result.success) {
            Toast.show?.(result.error || 'Approval failed', 'error');
            rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
            return;
        }

        video.status = 'approved';
        const newRow = this._buildRow(video);
        rowEl.parentNode.replaceChild(newRow, rowEl);
        this._renderStats();
        Toast.show?.(`Approved "${video.title}"`, 'success');
    }

    _showRejectModal(video, rowEl) {
        if (this.processing.has(video._id)) return;
        const handle = Modal.show({
            title: 'Reject Video',
            content: `
                <p>Reject <strong>${this._escapeHtml(video.title || '')}</strong>?</p>
                <form id="rv-form" novalidate>
                    <div class="form-group">
                        <label for="rv-reason">Rejection Reason *</label>
                        <textarea id="rv-reason" rows="3" maxlength="500" required></textarea>
                        <small style="color:#888;">The artist will see this. Be specific.</small>
                    </div>
                    <div id="rv-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
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
                const reason = document.getElementById('rv-reason').value.trim();
                const errorEl = document.getElementById('rv-error');
                if (reason.length < 5) {
                    errorEl.textContent = 'Reason must be at least 5 characters';
                    return;
                }

                this.processing.add(video._id);
                rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);
                submitBtn.disabled = true;
                submitBtn.textContent = 'Rejecting...';

                const result = await this.adminAPI.rejectVideo(video._id, reason);
                this.processing.delete(video._id);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm Rejection';

                if (!result.success) {
                    errorEl.textContent = result.error || 'Rejection failed';
                    rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
                    return;
                }

                handle?.close?.();
                video.status = 'rejected';
                const newRow = this._buildRow(video);
                rowEl.parentNode.replaceChild(newRow, rowEl);
                this._renderStats();
                Toast.show?.('Video rejected', 'info');
            });
        });
    }

    _deleteVideo(video, rowEl) {
        if (this.processing.has(video._id)) return;
        const doIt = async () => {
            this.processing.add(video._id);
            rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);
            const result = await this.adminAPI.deleteVideo(video._id);
            this.processing.delete(video._id);

            if (!result.success) {
                Toast.show?.(result.error || 'Failed to delete', 'error');
                rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
                return;
            }
            this.videos = this.videos.filter(v => v._id !== video._id);
            if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
            this._renderStats();
            if (this.videos.length === 0) this._renderTable();
            Toast.show?.('Video deleted', 'success');
        };
        if (window.Modal?.confirm) {
            Modal.confirm(`Delete "${video.title}"?`, doIt);
        } else if (confirm(`Delete "${video.title}"?`)) {
            doIt();
        }
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

window.AdminVideosPage = AdminVideosPage;
