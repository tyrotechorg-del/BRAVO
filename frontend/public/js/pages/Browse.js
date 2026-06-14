

class BrowsePage {
    constructor() {
        this.currentGenre = this._initialGenre();
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalSongs = 0;
        this.songs = [];
    }

    _initialGenre() {
        // Hash format: #browse?genre=Afrobeat
        const hash = window.location.hash || '';
        const m = /[?&]genre=([^&]+)/.exec(hash);
        return m ? decodeURIComponent(m[1]) : 'all';
    }

    _genres() {
        return Array.isArray(window.GENRES) && window.GENRES.length > 0
            ? window.GENRES
            : ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel',
               'Traditional', 'Amapiano', 'Cuundu', 'Soul', 'Rock', 'Kalindula', 'Other'];
    }

    async render() {
        return `
            <div class="browse-container">
                <div class="browse-header">
                    <h1>Browse Music</h1>
                    <p>Discover new music across all genres</p>
                </div>

                <div class="genre-filters" id="genre-filters" role="tablist" aria-label="Genre filters">
                    ${this._renderGenreButtons()}
                </div>

                <div class="songs-grid" id="browse-grid" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div><p>Loading songs...</p></div>
                </div>

                <div class="pagination" id="pagination"></div>
            </div>
        `;
    }

    _renderGenreButtons() {
        const genres = ['all', ...this._genres()];
        return genres.map(g => {
            const safeG = this._escapeHtml(g);
            const label = g === 'all' ? 'All' : safeG;
            const isActive = this.currentGenre === g;
            return `
                <button class="genre-filter ${isActive ? 'active' : ''}"
                        type="button"
                        role="tab"
                        aria-selected="${isActive}"
                        data-genre="${safeG}">
                    ${label}
                </button>
            `;
        }).join('');
    }

    async afterRender() {
        this._attachFilterListeners();
        await this._loadSongs();
    }

    _attachFilterListeners() {
        const container = document.getElementById('genre-filters');
        if (!container) return;
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.genre-filter');
            if (!btn) return;
            const genre = btn.dataset.genre;
            if (!genre || genre === this.currentGenre) return;

            // Update active states without rerendering the whole page.
            container.querySelectorAll('.genre-filter').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            this.currentGenre = genre;
            this.currentPage = 1;
            this._loadSongs();
        });
    }

    async _loadSongs() {
        const grid = document.getElementById('browse-grid');
        if (!grid) return;

        grid.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading songs...</p></div>';

        try {
            const songsAPI = new SongsAPI();
            const result = await songsAPI.getAll(this.currentPage, 20, this.currentGenre);
            this.songs = result?.songs || [];
            this.totalPages = result?.totalPages || 1;
            this.totalSongs = result?.total || this.songs.length;

            grid.innerHTML = '';

            if (this.songs.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-music"></i>
                        <h3>No songs found</h3>
                        <p>${this.currentGenre === 'all' ? 'No songs available yet.' : `No songs in "${this._escapeHtml(this.currentGenre)}" yet.`}</p>
                    </div>
                `;
                this._renderPagination();
                return;
            }

            // Use SongCard for every card. One render path, all fixes.
            this.songs.forEach(song => {
                new SongCard(song, grid, { playlist: this.songs });
            });

            this._renderPagination();
        } catch (err) {
            console.error('Load songs error:', err);
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load songs. Please try again.</p>
                </div>
            `;
        }
    }

    _renderPagination() {
        const container = document.getElementById('pagination');
        if (!container) return;

        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        const prevDisabled = this.currentPage <= 1;
        const nextDisabled = this.currentPage >= this.totalPages;

        container.innerHTML = `
            <div class="pagination-controls">
                <button class="page-btn" type="button" data-action="prev" ${prevDisabled ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>
                <button class="page-btn" type="button" data-action="next" ${nextDisabled ? 'disabled' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            if (btn.dataset.action === 'prev' && this.currentPage > 1) {
                this.currentPage--;
            } else if (btn.dataset.action === 'next' && this.currentPage < this.totalPages) {
                this.currentPage++;
            } else {
                return;
            }
            this._loadSongs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
        // {once:true} because we re-render the pagination block on
        // every load, replacing this container's children.
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.BrowsePage = BrowsePage;
