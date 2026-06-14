

class SearchPage {
    constructor() {
        this.query = this._initialQuery();
        this.activeTab = 'all'; // all | songs | artists | albums | playlists
        this.results = { songs: [], artists: [], albums: [], playlists: [] };
        this.loading = false;
        this.error = null;
        this._debounceTimer = null;
        this.searchAPI = new SearchAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
    }

    _initialQuery() {
        const hash = window.location.hash || '';
        const m = /[?&]q=([^&]+)/.exec(hash);
        return m ? decodeURIComponent(m[1]) : '';
    }

    async render() {
        const safeQuery = this._escapeAttr(this.query);
        return `
            <div class="search-container">
                <div class="search-header">
                    <h1><i class="fas fa-search"></i> Search</h1>
                    <p>Find songs, artists, albums, and playlists.</p>
                </div>

                <div class="search-input-wrap">
                    <input type="search"
                           id="search-input"
                           class="search-input"
                           placeholder="Search Bravo Music..."
                           value="${safeQuery}"
                           autocomplete="off"
                           autocorrect="off"
                           spellcheck="false"
                           aria-label="Search query">
                </div>

                <div class="search-tabs" role="tablist" aria-label="Search tabs">
                    ${this._renderTabs()}
                </div>

                <div class="search-results" id="search-results" aria-live="polite">
                    ${this._renderPlaceholder()}
                </div>
            </div>
        `;
    }

    _renderTabs() {
        const tabs = [
            { id: 'all', label: 'All' },
            { id: 'songs', label: 'Songs' },
            { id: 'artists', label: 'Artists' },
            { id: 'albums', label: 'Albums' },
            { id: 'playlists', label: 'Playlists' }
        ];
        return tabs.map(t => {
            const isActive = this.activeTab === t.id;
            return `
                <button class="search-tab ${isActive ? 'active' : ''}"
                        type="button"
                        role="tab"
                        aria-selected="${isActive}"
                        data-tab="${t.id}">
                    ${this._escapeHtml(t.label)}
                </button>
            `;
        }).join('');
    }

    _renderPlaceholder() {
        if (!this.query || this.query.trim().length < 2) {
            return `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Type at least 2 characters to search.</p>
                </div>
            `;
        }
        return `<div class="loading-container"><div class="spinner"></div></div>`;
    }

    async afterRender() {
        const input = document.getElementById('search-input');
        if (input) {
            input.addEventListener('input', (e) => this._onInput(e.target.value));
            input.focus();
        }

        // Tab clicks
        document.querySelectorAll('.search-tab').forEach(tab => {
            tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
        });

        // If we loaded with a query (from URL), execute immediately.
        if (this.query.trim().length >= 2) {
            await this._runSearch();
        }
    }

    _onInput(value) {
        this.query = value;
        if (this._debounceTimer) clearTimeout(this._debounceTimer);

        // Update URL hash so refresh / back preserves the query.
        // Only update if we're actually searching (>= 2 chars) to
        // avoid creating a million history entries while typing.
        if (this.query.trim().length >= 2) {
            history.replaceState(null, '', `#search?q=${encodeURIComponent(this.query.trim())}`);
        } else if (this.query.trim().length === 0) {
            history.replaceState(null, '', '#search');
            this._renderResults();
            return;
        }

        // Debounce: 150ms after last keystroke. Lower than the typical
        // 300ms so the page feels live as you type. Backend search is
        // cheap (regex on indexed fields) so this is fine for normal
        // typing speed.
        this._debounceTimer = setTimeout(() => this._runSearch(), 150);
    }

    async _switchTab(tabId) {
        if (!tabId || tabId === this.activeTab) return;
        this.activeTab = tabId;
        document.querySelectorAll('.search-tab').forEach(t => {
            const isActive = t.dataset.tab === tabId;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', String(isActive));
        });

        // Re-run search if needed (different tabs hit different
        // endpoints for richer per-resource pagination later).
        if (this.query.trim().length >= 2) {
            await this._runSearch();
        }
    }

    async _runSearch() {
        if (this.query.trim().length < 2) {
            this._renderResults();
            return;
        }

        this.loading = true;
        this.error = null;
        this._renderResults();

        let result;
        try {
            if (this.activeTab === 'all') {
                result = await this.searchAPI.searchAll(this.query, 5);
            } else if (this.activeTab === 'songs') {
                result = await this.searchAPI.searchSongs(this.query);
            } else if (this.activeTab === 'artists') {
                result = await this.searchAPI.searchArtists(this.query);
            } else if (this.activeTab === 'albums') {
                result = await this.searchAPI.searchAlbums(this.query);
            } else if (this.activeTab === 'playlists') {
                result = await this.searchAPI.searchPlaylists(this.query);
            }
        } catch (err) {
            console.error('Search error:', err);
            result = { success: false, error: 'Search failed' };
        }

        this.loading = false;

        if (!result.success) {
            this.error = result.error || 'Search failed';
            this._renderResults();
            return;
        }

        // The backend returns different shapes per endpoint.
        if (this.activeTab === 'all') {
            // searchAll returns { songs, artists, albums, playlists }
            this.results = {
                songs: result.data?.songs || [],
                artists: result.data?.artists || [],
                albums: result.data?.albums || [],
                playlists: result.data?.playlists || []
            };
        } else {
            // Per-resource returns paginated { items, total, page, totalPages }
            // OR a raw array depending on which controller. Tolerate both.
            const items = result.data?.songs
                || result.data?.artists
                || result.data?.albums
                || result.data?.playlists
                || result.data?.items
                || result.data
                || [];
            this.results = {
                songs: this.activeTab === 'songs' ? items : [],
                artists: this.activeTab === 'artists' ? items : [],
                albums: this.activeTab === 'albums' ? items : [],
                playlists: this.activeTab === 'playlists' ? items : []
            };
        }

        this._renderResults();
    }

    _renderResults() {
        const container = document.getElementById('search-results');
        if (!container) return;

        if (this.query.trim().length < 2) {
            container.innerHTML = this._renderPlaceholder();
            return;
        }

        if (this.loading) {
            container.innerHTML = `<div class="loading-container"><div class="spinner"></div></div>`;
            return;
        }

        if (this.error) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this._escapeHtml(this.error)}</p>
                </div>
            `;
            return;
        }

        const total = this.results.songs.length
            + this.results.artists.length
            + this.results.albums.length
            + this.results.playlists.length;

        if (total === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No results</h3>
                    <p>Try a different search.</p>
                </div>
            `;
            return;
        }

        // Build section blocks (only show sections that have hits).
        container.innerHTML = '';

        if (this.results.songs.length > 0) {
            const block = document.createElement('div');
            block.className = 'search-section';
            block.innerHTML = `<h2>Songs (${this.results.songs.length})</h2><div class="songs-grid" id="search-songs-grid"></div>`;
            container.appendChild(block);
            const grid = block.querySelector('#search-songs-grid');
            this.results.songs.forEach(song => {
                new SongCard(song, grid, { playlist: this.results.songs });
            });
        }

        if (this.results.artists.length > 0) {
            const block = document.createElement('div');
            block.className = 'search-section';
            block.innerHTML = `<h2>Artists (${this.results.artists.length})</h2><div class="artists-grid" id="search-artists-grid"></div>`;
            container.appendChild(block);
            const grid = block.querySelector('#search-artists-grid');
            this.results.artists.forEach(artist => grid.appendChild(this._buildArtistCard(artist)));
        }

        if (this.results.albums.length > 0) {
            const block = document.createElement('div');
            block.className = 'search-section';
            block.innerHTML = `<h2>Albums (${this.results.albums.length})</h2><div class="albums-grid" id="search-albums-grid"></div>`;
            container.appendChild(block);
            const grid = block.querySelector('#search-albums-grid');
            this.results.albums.forEach(album => grid.appendChild(this._buildAlbumCard(album)));
        }

        if (this.results.playlists.length > 0) {
            const block = document.createElement('div');
            block.className = 'search-section';
            block.innerHTML = `<h2>Playlists (${this.results.playlists.length})</h2><div class="playlists-grid" id="search-playlists-grid"></div>`;
            container.appendChild(block);
            const grid = block.querySelector('#search-playlists-grid');
            this.results.playlists.forEach(playlist => {
                if (window.PlaylistCard) {
                    new PlaylistCard(playlist, grid);
                } else {
                    grid.appendChild(this._buildPlaylistCardFallback(playlist));
                }
            });
        }
    }

    // Cards for non-song result types
    _buildArtistCard(artist) {
        const safeName = this._escapeHtml(artist.stageName || 'Unknown Artist');
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const card = document.createElement('div');
        card.className = 'artist-card';
        card.innerHTML = `
            <img class="artist-card-cover" alt="${safeName}">
            <div class="artist-card-info">
                <h4>${safeName}</h4>
                ${artist.verified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i></span>' : ''}
                <p>${this._formatNumber(artist.followerCount || 0)} followers</p>
            </div>
        `;
        const img = card.querySelector('.artist-card-cover');
        if (img) {
            img.src = this._getFullUrl(artist.avatar || artist.coverArt);
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }
        card.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(`artist/${artist._id}`);
            else window.location.hash = `artist/${artist._id}`;
        });
        return card;
    }

    _buildAlbumCard(album) {
        const safeTitle = this._escapeHtml(album.title || 'Untitled');
        const safeArtist = this._escapeHtml(album.artist?.stageName || 'Unknown Artist');
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img class="album-cover" alt="${safeTitle}">
            <div class="album-info">
                <h4>${safeTitle}</h4>
                <p>${safeArtist}</p>
            </div>
        `;
        const img = card.querySelector('.album-cover');
        if (img) {
            img.src = this._getFullUrl(album.coverArt);
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }
        card.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(`album/${album._id}`);
            else window.location.hash = `album/${album._id}`;
        });
        return card;
    }

    _buildPlaylistCardFallback(playlist) {
        const safeName = this._escapeHtml(playlist.name || 'Untitled');
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.innerHTML = `
            <img class="playlist-cover" alt="${safeName}">
            <div class="playlist-info">
                <h4>${safeName}</h4>
                <p>${playlist.songs?.length || 0} song${playlist.songs?.length === 1 ? '' : 's'}</p>
            </div>
        `;
        const img = card.querySelector('.playlist-cover');
        if (img) {
            img.src = this._getFullUrl(playlist.coverArt);
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }
        card.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(`playlist/${playlist._id}`);
            else window.location.hash = `playlist/${playlist._id}`;
        });
        return card;
    }

    _getFullUrl(url) {
        if (!url) return window.getDefaultImage?.() || '/js/images/bravo.png';
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

    _escapeAttr(text) {
        return this._escapeHtml(text);
    }
}

window.SearchPage = SearchPage;
