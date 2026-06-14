

class NotificationsPage {
    constructor() {
        this.notifications = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.unreadCount = 0;
        this.notificationsAPI = new NotificationsAPI();
        this.showUnreadOnly = false;
        this.loading = true;
    }

    async render() {
        return `
            <div class="notifications-page">
                <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h1><i class="fas fa-bell"></i> Notifications</h1>
                        <p id="nf-count" style="color:#888;">Loading...</p>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button id="nf-filter-btn" class="btn-secondary" type="button">
                            <i class="fas fa-filter"></i> <span id="nf-filter-label">Show all</span>
                        </button>
                        <button id="nf-mark-all-btn" class="btn-primary" type="button">
                            <i class="fas fa-check-double"></i> Mark all read
                        </button>
                    </div>
                </div>

                <div id="nf-list" style="margin-top:24px;" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div class="pagination" id="nf-pagination"></div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in to see your notifications', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        document.getElementById('nf-filter-btn')?.addEventListener('click', async () => {
            this.showUnreadOnly = !this.showUnreadOnly;
            this.currentPage = 1;
            document.getElementById('nf-filter-label').textContent = this.showUnreadOnly ? 'Showing unread' : 'Show all';
            await this._loadPage();
            this._renderList();
            this._renderPagination();
        });

        document.getElementById('nf-mark-all-btn')?.addEventListener('click', async () => {
            await this._markAllRead();
        });

        await this._loadPage();
        this._renderList();
        this._renderPagination();
    }

    async _loadPage() {
        this.loading = true;
        const result = await this.notificationsAPI.getAll(this.currentPage, 20, this.showUnreadOnly);
        if (result.success) {
            const data = result.data || {};
            this.notifications = data.notifications || data.items || [];
            this.totalPages = data.totalPages || 1;
            this.unreadCount = data.unreadCount || 0;
        } else {
            this.notifications = [];
            this.totalPages = 1;
        }
        this.loading = false;

        const countEl = document.getElementById('nf-count');
        if (countEl) {
            countEl.textContent = this.unreadCount > 0
                ? `${this.unreadCount} unread`
                : 'You\u2019re all caught up.';
        }
    }

    _renderList() {
        const list = document.getElementById('nf-list');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell-slash"></i>
                    <h3>No notifications</h3>
                    <p>${this.showUnreadOnly ? 'Nothing unread.' : 'You\u2019re all caught up.'}</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        this.notifications.forEach(n => {
            const row = this._buildRow(n);
            list.appendChild(row);
        });
    }

    _buildRow(n) {
        const isUnread = !n.read && !n.isRead;
        const icon = this._iconFor(n.type);
        const safeTitle = this._escapeHtml(n.title || 'Notification');
        const safeMsg = this._escapeHtml(n.message || '');
        const ago = this._timeAgo(n.createdAt || n.timestamp || Date.now());

        const row = document.createElement('div');
        row.className = 'notification-row';
        row.style.cssText = `
            background:${isUnread ? '#1a1a3e' : '#1a1a2e'};
            border:1px solid ${isUnread ? '#6c63ff' : '#2a2a3e'};
            border-radius:8px;
            padding:14px 16px;
            margin-bottom:8px;
            display:flex;
            align-items:flex-start;
            gap:12px;
            cursor:pointer;
            transition:background 0.15s;
        `;
        row.innerHTML = `
            <div style="flex:0 0 36px; width:36px; height:36px; border-radius:50%; background:#2a2a3e; display:flex; align-items:center; justify-content:center; font-size:18px;">
                ${icon}
            </div>
            <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <strong style="color:${isUnread ? '#fff' : '#ddd'};">${safeTitle}</strong>
                    <span style="color:#888; font-size:12px; white-space:nowrap;">${ago}</span>
                </div>
                ${safeMsg ? `<p style="margin:4px 0 0; color:#bbb; font-size:14px;">${safeMsg}</p>` : ''}
            </div>
            <button class="nf-delete-btn" type="button" title="Delete"
                style="background:transparent; border:none; color:#888; cursor:pointer; padding:4px;">
                <i class="fas fa-times"></i>
            </button>
        `;

        const deleteBtn = row.querySelector('.nf-delete-btn');
        deleteBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const result = await this.notificationsAPI.delete(n._id);
            if (result.success) {
                this.notifications = this.notifications.filter(x => x._id !== n._id);
                this._renderList();
            } else {
                Toast.show?.('Failed to delete notification', 'error');
            }
        });

        row.addEventListener('click', async () => {
            if (isUnread) {
                await this.notificationsAPI.markAsRead(n._id);
                n.read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this._renderList();
                const countEl = document.getElementById('nf-count');
                if (countEl) {
                    countEl.textContent = this.unreadCount > 0 ? `${this.unreadCount} unread` : 'You\u2019re all caught up.';
                }
            }
            // Optional: navigate to the related entity if URL provided
            if (n.link || n.url) {
                const url = n.link || n.url;
                if (url.startsWith('#') || url.startsWith('/')) {
                    window.location.hash = url.replace(/^[#/]+/, '');
                } else if (window.bravoApp?.navigateTo) {
                    window.bravoApp.navigateTo(url);
                }
            }
        });

        return row;
    }

    async _markAllRead() {
        const btn = document.getElementById('nf-mark-all-btn');
        if (btn) btn.disabled = true;

        const result = await this.notificationsAPI.markAllAsRead();

        if (btn) btn.disabled = false;

        if (result.success) {
            Toast.show?.('All notifications marked as read', 'success');
            this.notifications.forEach(n => { n.read = true; });
            this.unreadCount = 0;
            this._renderList();
            const countEl = document.getElementById('nf-count');
            if (countEl) countEl.textContent = 'You\u2019re all caught up.';
        } else {
            Toast.show?.(result.error || 'Failed to mark all as read', 'error');
        }
    }

    _renderPagination() {
        const container = document.getElementById('nf-pagination');
        if (!container) return;
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        const prevDis = this.currentPage <= 1;
        const nextDis = this.currentPage >= this.totalPages;
        container.innerHTML = `
            <div class="pagination-controls" style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">
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
            await this._loadPage();
            this._renderList();
            this._renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
    }

    _iconFor(type) {
        const icons = {
            like:          '<i class="fas fa-heart" style="color:#ff4757;"></i>',
            comment:       '<i class="fas fa-comment" style="color:#3498db;"></i>',
            follow:        '<i class="fas fa-user-plus" style="color:#9b59b6;"></i>',
            subscription:  '<i class="fas fa-crown" style="color:#f1c40f;"></i>',
            payment:       '<i class="fas fa-credit-card" style="color:#2ecc71;"></i>',
            withdrawal:    '<i class="fas fa-money-bill-wave" style="color:#27ae60;"></i>',
            admin:         '<i class="fas fa-shield-alt" style="color:#e74c3c;"></i>',
            welcome:       '<i class="fas fa-hand-wave" style="color:#6c63ff;"></i>',
            artist_update: '<i class="fas fa-music" style="color:#6c63ff;"></i>'
        };
        return icons[type] || '<i class="fas fa-bell"></i>';
    }

    _timeAgo(ts) {
        const date = new Date(ts);
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.NotificationsPage = NotificationsPage;
