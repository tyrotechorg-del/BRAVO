

class HomePage {
    constructor() {
        this.featured = [];
        this.trending = [];
    }

    async render() {
        const heroLogoSrc = window.getDefaultImage?.() || '/js/images/bravo.png';
        return `
            <div class="home-container">
                <div class="hero-section">
                    <div class="hero-content">
                        <div class="hero-logo">
                            <img src="${heroLogoSrc}" alt="Bravo Music" class="hero-logo-img">
                        </div>
                        <h1>Welcome to Bravo Music</h1>
                        <p>Zambia's Premier Music Platform</p>
                        <div class="hero-buttons">
                            <button class="btn-primary" type="button" data-nav="browse">Start Listening</button>
                            <button class="btn-outline" type="button" data-nav="register">Become an Artist</button>
                        </div>
                    </div>
                </div>

                <div class="popular-genres-section">
                    <div class="section-header">
                        <h2>Popular Genres</h2>
                        <a class="view-all" data-nav="browse" style="cursor:pointer;">View All →</a>
                    </div>
                    <div class="genre-chips" id="genre-chips">
                        ${this._renderGenreChips()}
                    </div>
                </div>

                <div class="featured-section">
                    <div class="section-header">
                        <h2>Featured This Week</h2>
                        <a class="view-all" data-nav="browse" style="cursor:pointer;">View All →</a>
                    </div>
                    <div class="songs-grid" id="featured-grid">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>
                </div>

                <div class="trending-section">
                    <div class="section-header">
                        <h2>Trending Now</h2>
                        <a class="view-all" data-nav="trending" style="cursor:pointer;">View All →</a>
                    </div>
                    <div class="songs-grid" id="home-trending-grid">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>
                </div>

                <div class="cta-section">
                    <div class="cta-content">
                        <h2>Are you an Artist?</h2>
                        <p>Upload your music, reach millions of listeners, and earn money from your art.</p>
                        <p class="artist-note"><small>Artists need email verification after registration</small></p>
                        <button class="btn-primary btn-large" type="button" data-nav="register">Start Your Journey</button>
                    </div>
                </div>
            </div>
        `;
    }

    _renderGenreChips() {
        // Pull from the canonical genre list (config.js → window.GENRES).
        // Each chip navigates to browse?genre=X which the Browse page
        // that depended on string matching in the search endpoint.)
        const genres = window.GENRES || [];
        return genres.map(g => {
            const safe = this._escapeHtml(g);
            return `<span class="genre-chip" data-genre="${safe}" tabindex="0" role="button">${safe}</span>`;
        }).join('');
    }

    async afterRender() {
        this._wireNavButtons();
        this._wireGenreChips();
        await Promise.all([this._loadFeatured(), this._loadTrending()]);
    }

    _wireNavButtons() {
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const dest = el.dataset.nav;
                if (window.bravoApp?.navigateTo) {
                    window.bravoApp.navigateTo(dest);
                } else {
                    window.location.hash = dest;
                }
            });
        });
    }

    _wireGenreChips() {
        document.querySelectorAll('.genre-chip').forEach(chip => {
            const navigate = () => {
                const genre = chip.dataset.genre;
                // The Browse page reads `?genre=` from the URL hash on init.
                if (window.bravoApp?.navigateTo) {
                    window.bravoApp.navigateTo(`browse?genre=${encodeURIComponent(genre)}`);
                } else {
                    window.location.hash = `browse?genre=${encodeURIComponent(genre)}`;
                }
            };
            chip.addEventListener('click', navigate);
            chip.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate();
                }
            });
        });
    }

    async _loadFeatured() {
        const grid = document.getElementById('featured-grid');
        if (!grid) return;
        try {
            const songsAPI = new SongsAPI();
            const featured = await songsAPI.getFeatured();
            this.featured = Array.isArray(featured) ? featured : [];
            this._renderGrid(grid, this.featured.slice(0, 8));
        } catch (err) {
            console.error('Failed to load featured songs:', err);
            this._renderEmpty(grid, 'No featured songs available');
        }
    }

    async _loadTrending() {
        const grid = document.getElementById('home-trending-grid');
        if (!grid) return;
        try {
            const songsAPI = new SongsAPI();
            const trending = await songsAPI.getTrending();
            this.trending = Array.isArray(trending) ? trending : [];
            this._renderGrid(grid, this.trending.slice(0, 8));
        } catch (err) {
            console.error('Failed to load trending songs:', err);
            this._renderEmpty(grid, 'No trending songs available');
        }
    }

    _renderGrid(grid, songs) {
        grid.innerHTML = '';
        if (songs.length === 0) {
            this._renderEmpty(grid, 'No songs yet');
            return;
        }
        // Pass the whole list as the playlist so clicking a song
        // queues the rest. (Better UX than each card being isolated.)
        songs.forEach(song => {
            new SongCard(song, grid, { playlist: songs });
        });
    }

    _renderEmpty(grid, message) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <p>${this._escapeHtml(message)}</p>
            </div>
        `;
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.HomePage = HomePage;
