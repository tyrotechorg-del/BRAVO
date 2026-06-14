

class Sidebar {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.render();

        if (window.authService?.onChange) {
            this._unsubscribe = window.authService.onChange(() => this.render());
        }

        // Update active item on hash change without re-rendering.
        this._onHashChange = () => this._setActiveItem();
        window.addEventListener('hashchange', this._onHashChange);
    }

    destroy() {
        if (typeof this._unsubscribe === 'function') {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        if (this._onHashChange) {
            window.removeEventListener('hashchange', this._onHashChange);
        }
    }

    _currentRoute() {
        // Strip leading # and any ?query suffix to get the bare route.
        const hash = window.location.hash || '';
        const path = hash.replace(/^#/, '');
        const qIdx = path.indexOf('?');
        return qIdx >= 0 ? path.slice(0, qIdx) : path;
    }

    _activeMatcher(itemPage, route) {
        // Exact match wins
        if (itemPage === route) return true;
        // Prefix matches for nested routes (artist/dashboard -> dashboard menu)
        if (itemPage === 'dashboard' && /^(artist|listener|admin)\/dashboard$/.test(route)) return true;
        // album/song/artist/playlist detail pages don't have a sidebar item
        return false;
    }

    _setActiveItem() {
        if (!this.container) return;
        const route = this._currentRoute();
        this.container.querySelectorAll('[data-page]').forEach(el => {
            el.classList.toggle('active', this._activeMatcher(el.dataset.page, route));
        });
    }

    render() {
        if (!this.container) return;

        const isAuthenticated = Boolean(window.authService?.isAuthenticated?.());
        const user = window.authService?.getUser?.();
        const role = user?.role || 'listener';

        this.container.innerHTML = `
            <div class="sidebar">
                <div class="sidebar-section">
                    <h3>MAIN</h3>
                    <ul class="sidebar-nav">
                        ${this._item('home', 'fa-home', 'Home')}
                        ${this._item('browse', 'fa-compass', 'Browse')}
                        ${this._item('trending', 'fa-fire', 'Trending')}
                        ${this._item('search', 'fa-search', 'Search')}
                    </ul>
                </div>

                ${isAuthenticated ? `
                    <div class="sidebar-section">
                        <h3>YOUR LIBRARY</h3>
                        <ul class="sidebar-nav">
                            ${this._item('liked', 'fa-heart', 'Liked Songs')}
                            ${this._item('recent', 'fa-history', 'Recently Played')}
                            ${this._item('downloads', 'fa-download', 'Downloads')}
                            ${this._item('playlists', 'fa-list', 'Playlists')}
                            ${this._item('albums', 'fa-compact-disc', 'Albums')}
                            ${this._item('videos', 'fa-video', 'Videos')}
                        </ul>
                    </div>

                    <div class="sidebar-section">
                        <h3>ACCOUNT</h3>
                        <ul class="sidebar-nav">
                            ${this._item('notifications', 'fa-bell', 'Notifications')}
                            ${this._item('wallet', 'fa-wallet', 'Wallet')}
                            ${this._item('subscription', 'fa-crown', 'Subscription')}
                            ${this._item('payment-history', 'fa-receipt', 'Payment History')}
                        </ul>
                    </div>
                ` : ''}

                ${(role === 'artist' || role === 'admin') ? `
                    <div class="sidebar-section">
                        <h3>ARTIST HUB</h3>
                        <ul class="sidebar-nav">
                            ${this._item('dashboard', 'fa-chart-line', 'Dashboard')}
                            ${this._item('upload', 'fa-upload', 'Upload')}
                            ${this._item('earnings', 'fa-wallet', 'Earnings')}
                            ${this._item('artist/albums', 'fa-compact-disc', 'My Albums')}
                        </ul>
                    </div>
                ` : ''}

                ${role === 'admin' ? `
                    <div class="sidebar-section">
                        <h3>ADMIN PANEL</h3>
                        <ul class="sidebar-nav">
                            ${this._item('admin/dashboard', 'fa-chart-bar', 'Overview')}
                            ${this._item('admin/all-songs', 'fa-headphones', 'All Songs')}
                            ${this._item('admin/pending', 'fa-clock', 'Pending Songs')}
                            ${this._item('admin/albums', 'fa-compact-disc', 'Albums')}
                            ${this._item('admin/users', 'fa-users', 'Users')}
                            ${this._item('admin/artists', 'fa-user', 'Artists')}
                            ${this._item('admin/withdrawals', 'fa-money-bill-wave', 'Withdrawals')}
                            ${this._item('admin/reports', 'fa-flag', 'Reports')}
                            ${this._item('admin/comments', 'fa-comment', 'Reported Comments')}
                            ${this._item('admin/settings', 'fa-cog', 'System Settings')}
                        </ul>
                    </div>
                ` : ''}

                <div class="sidebar-footer">
                    ${isAuthenticated ? this._item('settings', 'fa-cog', 'Settings') : ''}
                    ${role === 'listener' ? this._item('upgrade', 'fa-crown', 'Become Artist') : ''}
                </div>
            </div>
        `;

        this._attachEventListeners();
        this._setActiveItem();
    }

    _item(page, icon, label) {
        return `
            <li>
                <button class="sidebar-item" type="button" data-page="${this._escapeAttr(page)}">
                    <i class="fas ${icon}"></i> ${this._escapeHtml(label)}
                </button>
            </li>
        `;
    }

    _attachEventListeners() {
        this.container.querySelectorAll('[data-page]').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                if (window.bravoApp?.navigateTo) {
                    window.bravoApp.navigateTo(page);
                } else {
                    window.location.hash = page;
                }
            });
        });
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

window.Sidebar = Sidebar;
