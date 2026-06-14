

class LikedPage {
    constructor() {
        this.songs = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.total = 0;
        this.userAPI = new UserAPI();
        this.loading = true;
    }

    async render() {
        return `
            <div class="liked-page">
                <div class="page-header">
                    <h1><i class="fas fa-heart" style="color:#ff4757;"></i> Liked Songs</h1>
                    <p id="liked-count" style="color:#888;">Loading...</p>
                </div>

                <div id="liked-songs-grid" class="songs-grid" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div class="pagination" id="liked-pagination"></div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in to see your liked songs', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        await this._loadPage();
        this._renderSongs();
        this._renderPagination();
        this._renderCount();
    }

    async _loadPage() {
        this.loading = true;
        const result = await this.userAPI.getLikedSongs(this.currentPage, 20);
        if (result.success) {
            const data = result.data || {};
            this.songs = data.songs || [];
            this.totalPages = data.totalPages || 1;
            this.total = data.total || 0;

            // Sync localStorage for the heart-icon offline indicator
            // (SongCard reads bravo_liked to know which hearts to fill)
            try {
                const liked = JSON.parse(localStorage.getItem('bravo_liked') || '[]');
                const fromServer = new Set(this.songs.map(s => s._id));
                // Only ADD ids we just saw — don't trim, since other pages
                // may not be loaded yet. Trimming happens lazily.
                const merged = Array.from(new Set([...liked, ...fromServer]));
                localStorage.setItem('bravo_liked', JSON.stringify(merged));
            } catch {}
        } else {
            this.songs = [];
            this.totalPages = 1;
            this.total = 0;
        }
        this.loading = false;
    }

    _renderCount() {
        const el = document.getElementById('liked-count');
        if (!el) return;
        if (this.total === 0) {
            el.textContent = 'You haven\u2019t liked any songs yet.';
        } else {
            el.textContent = `${this.total} song${this.total === 1 ? '' : 's'}`;
        }
    }

    _renderSongs() {
        const grid = document.getElementById('liked-songs-grid');
        if (!grid) return;

        if (this.songs.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart"></i>
                    <h3>No liked songs yet</h3>
                    <p>Tap the heart on any song to add it here.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        this.songs.forEach(song => {
            const container = document.createElement('div');
            container.className = 'song-card-wrapper';
            grid.appendChild(container);
            // escape, premium gating, play wiring, etc.
            new SongCard(song, container, { context: 'liked', allSongs: this.songs });
        });
    }

    _renderPagination() {
        const container = document.getElementById('liked-pagination');
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
            this._renderSongs();
            this._renderPagination();
            this._renderCount();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
    }
}

window.LikedPage = LikedPage;
