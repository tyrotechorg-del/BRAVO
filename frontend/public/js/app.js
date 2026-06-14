/**
 * BravoMusicApp — top-level boot, route table, socket wiring, mobile menu, keyboard shortcuts.
 */

class BravoMusicApp {
    constructor() {
        this.currentPage = null;
        this.audioPlayer = null;
        this.socket = null;
        this.notificationCount = 0;
        this._unsubscribeAuth = null;
    }

    async init() {
        // 1. Auth state from the canonical service
        await this._ensureAuthLoaded();

        // 2. Render the chrome (navbar + sidebar live in their own components now)
        this._renderChrome();

        // 3. Mount the audio player (one global instance — survives navigation)
        const audioContainer = document.getElementById('audio-player-container');
        if (audioContainer && window.AudioPlayer) {
            this.audioPlayer = new AudioPlayer('#audio-player-container');
            // Expose for cross-page playback ('open song detail → play this song')
            window.bravoApp = window.bravoApp || this;
        }

        // 4. Wire navigation (router + sidebar active item)
        this._setupNavigation();
        this._setupMobileMenu();

        // 5. Socket — only if signed in
        if (window.authService?.isAuthenticated?.()) {
            this._setupSocket();
        }

        // 6. React to auth changes (login, logout, role switch)
        this._unsubscribeAuth = window.authService?.onChange?.((user) => {
            this._renderChrome();
            if (user) {
                this._setupSocket();
            } else {
                this._teardownSocket();
            }
        });

        // 7. Handle URL params (email verification, etc.) — only on first paint
        this._handleUrlParams();

        // 8. Boot the first page
        await this._loadPage(this._getPageFromHash());

        // 9. Welcome toast — only ever once, only for newly-signed-up users
        this._maybeWelcome();
    }

    // Boot helpers
    async _ensureAuthLoaded() {
        // authService initializes itself via its module load. If the user is
        // authenticated but the cached user object is missing, fetch fresh.
        if (window.authService?.isAuthenticated?.() && !window.authService.getUser()) {
            try {
                const userAPI = new UserAPI();
                const result = await userAPI.getProfile();
                if (result.success) {
                    const user = result.data?.user || result.data;
                    if (user) window.authService.setUser(user);
                }
            } catch (err) {
                console.warn('[app] Could not fetch profile during boot:', err.message);
            }
        }

        // Show an unobtrusive nag if email isn't verified yet.
        const user = window.authService?.getUser?.();
        if (user && user.isVerified === false) {
            setTimeout(() => {
                Toast.show?.('Please verify your email to access all features.', 'warning', 6000);
            }, 1500);
        }
    }

    _handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('verified') === 'true') {
            Toast.show?.('Email verified successfully. You can sign in.', 'success');
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
    }

    _maybeWelcome() {
        // Show "welcome" only once ever per device. Avoids the annoying
        // "Welcome to Bravo Music!" toast on every page load.
        try {
            if (!localStorage.getItem('bravo_welcome_seen')) {
                localStorage.setItem('bravo_welcome_seen', '1');
                Toast.show?.('Welcome to Bravo Music', 'success', 3000);
            }
        } catch {}
    }

    // Chrome (navbar + sidebar)
    _renderChrome() {
        // not a DOM element. Their constructors call `document.querySelector(arg)`
        // internally — passing the element makes querySelector stringify it to
        // '[object HTMLDivElement]' which is not a valid selector. The fix is
        // simply to pass the selector.
        if (document.getElementById('navbar-container') && window.Navbar) {
            new Navbar('#navbar-container');
        }
        if (document.getElementById('sidebar-container') && window.Sidebar) {
            new Sidebar('#sidebar-container');
        }
    }

    // Navigation
    _setupNavigation() {
        window.addEventListener('hashchange', () => this._loadPage(this._getPageFromHash()));
        window.addEventListener('popstate', () => this._loadPage(this._getPageFromHash()));

        // Delegated click handler for [data-page] elements anywhere in the chrome
        document.body.addEventListener('click', (e) => {
            const navEl = e.target.closest('[data-page]');
            if (!navEl) return;
            const page = navEl.dataset.page;
            if (!page) return;
            e.preventDefault();
            this.navigateTo(page);
        });
    }

    navigateTo(page) {
        if (!page) return;
        // Strip leading # if accidentally included
        const clean = String(page).replace(/^#/, '');
        if (window.location.hash === `#${clean}`) {
            // Already there — force a reload of the same page
            this._loadPage(clean);
        } else {
            window.location.hash = clean;
        }
    }

    _getPageFromHash() {
        const hash = (window.location.hash || '').replace(/^#/, '');
        return hash || 'home';
    }

    async _loadPage(routeWithQuery) {
        // Strip ?query from the route portion for matching
        const [route] = String(routeWithQuery).split('?');

        const main = document.getElementById('main-content');
        if (!main) return;

        // Show a spinner while the page builds
        main.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';

        let pageInstance = null;

        // Dynamic routes (album/123, artist/abc, song/xyz)
        if (route.startsWith('album/')) {
            const id = route.split('/')[1];
            if (window.AlbumView) pageInstance = new AlbumView(id);
        } else if (route.startsWith('artist/') && route !== 'artist/albums') {
            const id = route.split('/')[1];
            if (window.ArtistProfile) pageInstance = new ArtistProfile(id);
        } else if (route.startsWith('song/')) {
            const id = route.split('/')[1];
            if (window.SongDetailPage) pageInstance = new SongDetailPage(id);
        } else {
            pageInstance = this._instantiateStaticRoute(route);
        }

        if (!pageInstance) {
            main.innerHTML = `
                <div class="empty-state">
                    <h2>Page not found</h2>
                    <p>The page "${this._escape(route)}" doesn't exist.</p>
                    <button class="btn-primary" type="button" data-page="home">Go home</button>
                </div>
            `;
            return;
        }

        try {
            const html = typeof pageInstance.render === 'function' ? await pageInstance.render() : '';
            main.innerHTML = html;
            if (typeof pageInstance.afterRender === 'function') {
                await pageInstance.afterRender();
            }
            this.currentPage = pageInstance;
        } catch (err) {
            console.error('[app] Page load error:', err);
            main.innerHTML = `
                <div class="empty-state">
                    <h2>Something went wrong</h2>
                    <p>The page failed to load. Please try again.</p>
                    <button class="btn-primary" type="button" id="retry-page-btn">Retry</button>
                </div>
            `;
            document.getElementById('retry-page-btn')?.addEventListener('click', () => {
                this._loadPage(routeWithQuery);
            });
        }
    }

    _instantiateStaticRoute(route) {
        // Map of static route → page class. Centralizing here means the
        const map = {
            // Auth
            'login':                 window.LoginPage,
            'register':              window.RegisterPage,
            'forgot-password':       window.ForgotPasswordPage,
            'reset-password':        window.ResetPasswordPage,
            'verify-email':          window.VerifyEmailPage,

            // Discovery
            '':                      window.HomePage,
            'home':                  window.HomePage,
            'browse':                window.BrowsePage,
            'trending':              window.TrendingPage,
            'search':                window.SearchPage,
            'albums':                window.AlbumsPage,

            // Upload
            'upload':                window.UploadPage,

            // User dashboards
            'artist/albums':         window.ArtistAlbumsPage,
            'settings':              window.SettingsPage,
            'earnings':              window.EarningsPage,
            'downloads':             window.DownloadsPage,
            'liked':                 window.LikedPage,
            'recent':                window.RecentPage,
            'playlists':             window.PlaylistsPage,
            'notifications':         window.NotificationsPage,
            'videos':                window.VideosPage,
            'upgrade':               window.UpgradePage,

            // Wallet & subscriptions
            'wallet':                window.WalletPage,
            'subscription':          window.SubscriptionPage,
            'payment-history':       window.PaymentHistoryPage,

            // Admin
            'admin':                 window.AdminDashboardPage,
            'admin/dashboard':       window.AdminDashboardPage,
            'admin/users':           window.AdminUsersPage,
            'admin/artists':         window.AdminArtistsPage,
            'admin/all-songs':       window.AdminAllSongsPage,
            'admin/pending':         window.AdminSongsPage,
            'admin/albums':          window.AdminAlbumsPage,
            'admin/videos':          window.AdminVideosPage,
            'admin/withdrawals':     window.AdminWithdrawalsPage,
            'admin/reports':         window.AdminReportsPage,
            'admin/comments':        window.AdminCommentsPage,
            'admin/settings':        window.AdminSettingsPage
        };

        // 'dashboard' branches by role
        if (route === 'dashboard') {
            const role = window.authService?.getUser?.()?.role;
            // The actual exports from ArtistDashboard.js / ListenerDashboard.js
            // are *Page-suffixed classes — match those names exactly or the
            // route falls through to "Page not found".
            if ((role === 'artist' || role === 'admin') && window.ArtistDashboardPage) {
                return new ArtistDashboardPage();
            }
            if (window.ListenerDashboardPage) return new ListenerDashboardPage();
            return null;
        }

        const Klass = map[route];
        return Klass ? new Klass() : null;
    }

    _setupMobileMenu() {
        // toggles the right-side .nav-menu (login/avatar). On mobile
        // viewports we ALSO want that same button to open/close the
        // LEFT sidebar drawer (categories). Both listeners attach to
        // the same button — Navbar's handler stays as-is, and this one
        // adds the sidebar toggling on top.
        const sidebarOverlay = () => {
            let overlay = document.querySelector('.sidebar-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'sidebar-overlay';
                overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:99; display:none;';
                document.body.appendChild(overlay);
                overlay.addEventListener('click', () => {
                    document.querySelector('.sidebar')?.classList.remove('mobile-open');
                    overlay.style.display = 'none';
                });
            }
            return overlay;
        };

        // Delegated handler — works even when Navbar re-renders the button.
        // Match the Navbar's actual id (#mobile-menu-btn), not the older
        // #mobile-sidebar-btn (which never existed in this codebase).
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('#mobile-menu-btn');
            if (!btn) return;
            const sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;
            const overlay = sidebarOverlay();
            const opening = !sidebar.classList.contains('mobile-open');
            sidebar.classList.toggle('mobile-open', opening);
            overlay.style.display = opening ? 'block' : 'none';
        });

        // Auto-close the sidebar drawer when a sidebar link is tapped
        // (otherwise it stays open over the new page).
        document.body.addEventListener('click', (e) => {
            const item = e.target.closest('.sidebar-item');
            if (!item) return;
            const sidebar = document.querySelector('.sidebar');
            if (sidebar?.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
                const overlay = document.querySelector('.sidebar-overlay');
                if (overlay) overlay.style.display = 'none';
            }
        });
    }

    // Socket (real-time notifications + live counts)
    _setupSocket() {
        if (this.socket || !window.SocketService) return;
        try {
            this.socket = new SocketService();
            // Hand off token via the service (which uses authService internally).
            this.socket.connect();
            this._setupSocketListeners();
        } catch (err) {
            console.warn('[app] Socket setup failed:', err.message);
        }
    }

    _teardownSocket() {
        if (!this.socket) return;
        try { this.socket.disconnect(); } catch {}
        this.socket = null;
    }

    _setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on?.('notification', (notification) => {
            const safeTitle = this._escape(notification.title || 'Notification');
            const safeMsg = this._escape(notification.message || '');
            Toast.show?.(`${this._notificationIcon(notification.type)} ${safeTitle}: ${safeMsg}`, 'info', 5000);
            this._updateNotificationBadge();
        });

        this.socket.on?.('listener-count', (data) => {
            const el = document.getElementById('live-listeners');
            if (!el) return;
            const safe = parseInt(data?.count, 10) || 0;
            el.innerHTML = `<i class="fas fa-headphones"></i> ${safe} listening now`;
        });

        window.addEventListener('bravo:purchase-complete', () => {
            // Force the current page to refresh if it supports it
            if (typeof this.currentPage?.afterRender === 'function') {
                this.currentPage.afterRender();
            }
        });
    }

    _notificationIcon(type) {
        const icons = {
            like:           '\u2764\uFE0F',     // ❤️
            comment:        '\uD83D\uDCAC',     // 💬
            follow:         '\uD83D\uDC64',     // 👤
            subscription:   '\uD83D\uDC51',     // 👑
            withdrawal:     '\uD83D\uDCB0',     // 💰
            admin:          '\uD83D\uDEE1\uFE0F', // 🛡️
            welcome:        '\uD83C\uDF89',     // 🎉
            artist_update:  '\uD83C\uDFB5'      // 🎵
        };
        return icons[type] || '\uD83D\uDD14';   // 🔔
    }

    async _updateNotificationBadge() {
        if (!window.authService?.isAuthenticated?.()) return;
        try {
            // Route through authService — no direct fetch with localStorage tokens.
            const result = await window.authService.api._request('/notifications/unread-count', { method: 'GET' });
            if (!result.ok) return;
            this.notificationCount = result.data?.count || 0;
            const badge = document.getElementById('notification-badge');
            if (!badge) return;
            if (this.notificationCount > 0) {
                badge.textContent = this.notificationCount > 99 ? '99+' : String(this.notificationCount);
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        } catch {
            // Silently fail — badge stays at its previous value.
        }
    }

    // Helpers
    _escape(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

// Boot when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new BravoMusicApp();
    window.bravoApp = app;
    app.init().catch(err => {
        console.error('[app] Init failed:', err);
        const main = document.getElementById('main-content');
        if (main) {
            main.innerHTML = `
                <div class="empty-state">
                    <h2>Couldn't start Bravo Music</h2>
                    <p>Please refresh the page or try again later.</p>
                </div>
            `;
        }
    });
});
