/**
 * Navbar Component
 */

class Navbar {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.apiUrl = window.API_BASE_URL;
        this._suggestionsTimer = null;
        this._suggestionsAPI = null;
        this.render();

        // Re-render on auth state changes.
        if (window.authService?.onChange) {
            this._unsubscribe = window.authService.onChange(() => this.render());
        }
    }

    destroy() {
        if (typeof this._unsubscribe === 'function') {
            this._unsubscribe();
            this._unsubscribe = null;
        }
    }

    _safeAvatarUrl(url) {
        if (!url || typeof url !== 'string') return window.getDefaultImage?.() || '/js/images/bravo.png';
        if (/^javascript:/i.test(url) || /^data:text/i.test(url)) {
            return window.getDefaultImage?.() || '/js/images/bravo.png';
        }
        return url;
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    render() {
        if (!this.container) return;

        const isAuthenticated = Boolean(window.authService?.isAuthenticated?.());
        const user = window.authService?.getUser?.() || null;
        const safeUsername = this._escapeHtml(user?.username || 'User');
        const safeAvatar = this._escapeHtml(this._safeAvatarUrl(user?.avatar));
        const fallback = this._escapeHtml(window.getDefaultImage?.() || '/js/images/bravo.png');
        const logoSrc = this._escapeHtml(window.getDefaultImage?.() || '/js/images/bravo.png');

        this.container.innerHTML = `
            <nav class="navbar">
                <div class="logo" id="navbar-logo" tabindex="0" role="button">
                    <img src="${logoSrc}" alt="Bravo Music" class="logo-img">
                    <span>Bravo Music</span>
                </div>

                <div class="nav-search">
                    <input type="search" id="global-search"
                           placeholder="Search songs, artists, albums..."
                           autocomplete="off"
                           autocorrect="off"
                           spellcheck="false"
                           aria-label="Search">
                    <button id="global-search-btn" type="button" aria-label="Search">
                        <i class="fas fa-search"></i>
                    </button>
                    <div id="search-suggestions" class="search-suggestions" hidden role="listbox"></div>
                </div>

                <div class="nav-menu" id="nav-menu">
                    ${isAuthenticated ? `
                        <div class="dropdown" id="user-dropdown">
                            <button class="nav-link user-menu" type="button" id="user-menu-btn" aria-haspopup="true" aria-expanded="false">
                                <img class="user-avatar" alt="${safeUsername}" data-fallback="${fallback}" src="${safeAvatar}">
                                <span>${safeUsername}</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="dropdown-menu" id="user-dropdown-menu" hidden>
                                <button class="dropdown-item" type="button" data-page="dashboard">
                                    <i class="fas fa-tachometer-alt"></i> Dashboard
                                </button>
                                <button class="dropdown-item" type="button" data-page="settings">
                                    <i class="fas fa-cog"></i> Settings
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item" type="button" id="logout-btn">
                                    <i class="fas fa-sign-out-alt"></i> Logout
                                </button>
                            </div>
                        </div>
                    ` : `
                        <button class="nav-link" type="button" data-page="login">Login</button>
                        <button class="btn-primary" type="button" data-page="register">Sign Up</button>
                    `}
                </div>

                <button class="mobile-menu-btn" type="button" id="mobile-menu-btn" aria-label="Open menu">
                    <i class="fas fa-bars"></i>
                </button>
            </nav>
        `;

        this._wireAvatarFallback();
        this._attachEventListeners();
    }

    _wireAvatarFallback() {
        this.container.querySelectorAll('img[data-fallback]').forEach(img => {
            const fallback = img.getAttribute('data-fallback');
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        });
    }

    _attachEventListeners() {
        // Logo → home
        const logo = document.getElementById('navbar-logo');
        if (logo) {
            const goHome = () => this._navigate('home');
            logo.addEventListener('click', goHome);
            logo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goHome();
                }
            });
        }

        // Search button + Enter
        const searchInput = document.getElementById('global-search');
        const searchBtn = document.getElementById('global-search-btn');
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this._commitSearch(searchInput.value));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._commitSearch(searchInput.value);
                }
            });
            searchInput.addEventListener('input', () => this._showSuggestions(searchInput.value));
            searchInput.addEventListener('focus', () => this._showSuggestions(searchInput.value));
            searchInput.addEventListener('blur', () => {
                // Delay so a click on a suggestion can register first.
                setTimeout(() => this._hideSuggestions(), 200);
            });
        }

        // User dropdown
        const userBtn = document.getElementById('user-menu-btn');
        const userMenu = document.getElementById('user-dropdown-menu');
        if (userBtn && userMenu) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !userMenu.hasAttribute('hidden');
                if (isOpen) {
                    userMenu.setAttribute('hidden', '');
                    userBtn.setAttribute('aria-expanded', 'false');
                } else {
                    userMenu.removeAttribute('hidden');
                    userBtn.setAttribute('aria-expanded', 'true');
                }
            });
            document.addEventListener('click', () => {
                userMenu.setAttribute('hidden', '');
                userBtn.setAttribute('aria-expanded', 'false');
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await window.authService?.logout?.();
                window.location.reload();
            });
        }

        // Mobile menu toggle
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const navMenu = document.getElementById('nav-menu');
        if (mobileBtn && navMenu) {
            mobileBtn.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // Data-page navigation (dropdown items, sign in/up buttons)
        this.container.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', () => {
                this._navigate(el.dataset.page);
            });
        });
    }

    _navigate(page) {
        if (window.bravoApp?.navigateTo) {
            window.bravoApp.navigateTo(page);
        } else {
            window.location.hash = page;
        }
    }

    _commitSearch(query) {
        const q = String(query || '').trim();
        if (q.length < 2) {
            Toast.show?.('Type at least 2 characters', 'info');
            return;
        }
        if (window.bravoApp?.navigateTo) {
            window.bravoApp.navigateTo(`search?q=${encodeURIComponent(q)}`);
        } else {
            window.location.hash = `search?q=${encodeURIComponent(q)}`;
        }
        this._hideSuggestions();
    }

    // Typeahead suggestions
    _showSuggestions(query) {
        const q = String(query || '').trim();
        if (this._suggestionsTimer) clearTimeout(this._suggestionsTimer);

        if (q.length < 2) {
            this._hideSuggestions();
            return;
        }

        this._suggestionsTimer = setTimeout(() => this._fetchSuggestions(q), 250);
    }

    _hideSuggestions() {
        const box = document.getElementById('search-suggestions');
        if (box) {
            box.hidden = true;
            box.innerHTML = '';
        }
    }

    async _fetchSuggestions(query) {
        if (!window.SearchAPI) return;
        if (!this._suggestionsAPI) this._suggestionsAPI = new SearchAPI();

        const result = await this._suggestionsAPI.getSuggestions(query, 8);
        if (!result.success) {
            // Don't surface errors on typeahead — fall back silently.
            this._hideSuggestions();
            return;
        }

        const items = Array.isArray(result.data?.suggestions) ? result.data.suggestions
            : Array.isArray(result.data) ? result.data
            : [];

        const box = document.getElementById('search-suggestions');
        if (!box) return;

        if (items.length === 0) {
            this._hideSuggestions();
            return;
        }

        box.innerHTML = items.map(item => {
            const label = this._escapeHtml(item.label || item.title || item.name || '');
            const type = this._escapeHtml(item.type || 'song');
            const icon = type === 'artist' ? 'fa-user'
                       : type === 'album' ? 'fa-compact-disc'
                       : type === 'playlist' ? 'fa-list'
                       : 'fa-music';
            const targetType = type === 'artist' ? 'artist'
                             : type === 'album' ? 'album'
                             : type === 'playlist' ? 'playlist'
                             : 'song';
            const targetId = this._escapeHtml(item._id || '');
            return `
                <button type="button" class="search-suggestion-item" role="option"
                        data-target="${targetType}/${targetId}">
                    <i class="fas ${icon}"></i>
                    <span class="suggestion-label">${label}</span>
                    <span class="suggestion-type">${type}</span>
                </button>
            `;
        }).join('');

        box.hidden = false;

        box.querySelectorAll('.search-suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                this._navigate(el.dataset.target);
                this._hideSuggestions();
                const input = document.getElementById('global-search');
                if (input) input.value = '';
            });
        });
    }
}

window.Navbar = Navbar;
