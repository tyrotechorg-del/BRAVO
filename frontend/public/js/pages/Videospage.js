

class VideosPage {
    constructor() {
        this.videos = [];
        this.songsAPI = new SongsAPI();
        this.currentPage = 1;
        this.totalPages = 1;
        this.selectedGenre = null;
        this.loading = true;
    }

    async render() {
        const genres = window.GENRES || ['Afrobeat', 'Amapiano', 'Hip Hop', 'R&B', 'Gospel'];
        const genreOpts = ['<option value="">All genres</option>',
            ...genres.map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`)].join('');

        return `
            <div class="videos-page">
                <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h1><i class="fas fa-video"></i> Music Videos</h1>
                        <p id="vd-count" style="color:#888;">Loading...</p>
                    </div>
                    <select id="vd-genre" style="background:#1a1a2e; color:#fff; border:1px solid #2a2a3e; border-radius:6px; padding:8px 12px;">
                        ${genreOpts}
                    </select>
                </div>

                <div id="vd-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px; margin-top:24px;" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div class="pagination" id="vd-pagination"></div>
            </div>
        `;
    }

    async afterRender() {
        const genreSelect = document.getElementById('vd-genre');
        genreSelect?.addEventListener('change', async (e) => {
            this.selectedGenre = e.target.value || null;
            this.currentPage = 1;
            await this._loadPage();
            this._renderGrid();
            this._renderPagination();
        });

        await this._loadPage();
        this._renderGrid();
        this._renderPagination();
    }

    async _loadPage() {
        this.loading = true;
        try {
            const result = await this.songsAPI.getVideos(this.currentPage, 20, this.selectedGenre);
            if (result && (result.videos || result.songs)) {
                this.videos = result.videos || result.songs || [];
                this.totalPages = result.totalPages || 1;
            } else if (Array.isArray(result)) {
                this.videos = result;
                this.totalPages = 1;
            } else {
                this.videos = [];
                this.totalPages = 1;
            }
        } catch (err) {
            console.error('Failed to load videos', err);
            this.videos = [];
            this.totalPages = 1;
        }
        this.loading = false;
    }

    _renderGrid() {
        const grid = document.getElementById('vd-grid');
        const count = document.getElementById('vd-count');
        if (!grid) return;

        if (count) {
            count.textContent = this.videos.length === 0
                ? 'No videos available.'
                : `Showing ${this.videos.length} video${this.videos.length === 1 ? '' : 's'}`;
        }

        if (this.videos.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <i class="fas fa-video"></i>
                    <h3>No videos yet</h3>
                    <p>${this.selectedGenre ? `No videos in "${this._escapeHtml(this.selectedGenre)}" yet.` : 'Check back soon for new releases.'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        this.videos.forEach(video => {
            const card = this._buildCard(video);
            grid.appendChild(card);
        });
    }

    _buildCard(video) {
        const safeTitle = this._escapeHtml(video.title || 'Untitled');
        const safeArtist = this._escapeHtml(video.artist?.stageName || video.artistName || 'Unknown Artist');
        const safeGenre = this._escapeHtml(video.genre || '');
        const thumbUrl = this._resolveImageUrl(video.coverArt || video.thumbnail);
        const defaultImg = window.getDefaultImage?.() || '/js/images/bravo.png';
        const plays = Number(video.playCount || video.views || 0);

        const div = document.createElement('div');
        div.className = 'video-card';
        div.style.cssText = 'background:#1a1a2e; border-radius:12px; overflow:hidden; cursor:pointer; transition:transform 0.2s;';
        div.onmouseenter = () => (div.style.transform = 'translateY(-4px)');
        div.onmouseleave = () => (div.style.transform = 'none');

        div.innerHTML = `
            <div style="position:relative; aspect-ratio:16/9; background:#0a0a1e; overflow:hidden;">
                <img class="vd-thumb" alt="" style="width:100%; height:100%; object-fit:cover;">
                <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); opacity:0; transition:opacity 0.2s;" class="vd-overlay">
                    <i class="fas fa-play-circle" style="font-size:48px; color:white;"></i>
                </div>
            </div>
            <div style="padding:12px;">
                <h3 style="font-size:14px; margin:0 0 4px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeTitle}</h3>
                <p style="font-size:12px; color:#888; margin:0;">${safeArtist}</p>
                <p style="font-size:11px; color:#666; margin:6px 0 0; display:flex; justify-content:space-between;">
                    <span><i class="fas fa-eye"></i> ${this._formatNumber(plays)}</span>
                    ${safeGenre ? `<span>${safeGenre}</span>` : ''}
                </p>
            </div>
        `;

        // Image fallback + lazy resolution (avoid inline onerror XSS surface)
        const img = div.querySelector('.vd-thumb');
        if (img) {
            img.src = thumbUrl || defaultImg;
            img.addEventListener('error', () => { img.src = defaultImg; }, { once: true });
        }

        const overlay = div.querySelector('.vd-overlay');
        div.addEventListener('mouseenter', () => { if (overlay) overlay.style.opacity = '1'; });
        div.addEventListener('mouseleave', () => { if (overlay) overlay.style.opacity = '0'; });

        div.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) {
                window.bravoApp.navigateTo(`song/${video._id}`);
            } else {
                window.location.hash = `song/${video._id}`;
            }
        });

        return div;
    }

    _renderPagination() {
        const container = document.getElementById('vd-pagination');
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
            this._renderGrid();
            this._renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
    }

    _resolveImageUrl(url) {
        if (!url) return null;
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${window.APP_CONFIG?.STATIC_URL || ''}${url}`;
        }
        return url;
    }

    _formatNumber(n) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
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

window.VideosPage = VideosPage;
