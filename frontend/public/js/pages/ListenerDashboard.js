

class ListenerDashboardPage {
    constructor() {
        this.recentlyPlayed = [];
        this.likedSongs = [];
    }

    async render() {
        const isAuth = Boolean(window.authService?.isAuthenticated?.());
        if (!isAuth) {
            return `
                <div class="dashboard-container">
                    <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                        <i class="fas fa-lock" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                        <h2>Sign in to view your dashboard</h2>
                        <button class="btn-primary" type="button" data-nav="login">Sign In</button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="dashboard-container">
                <h1>Your Library</h1>

                <div class="dashboard-stats">
                    <div class="stat-card">
                        <h3>Liked Songs</h3>
                        <div class="value" id="liked-count">—</div>
                    </div>
                    <div class="stat-card">
                        <h3>Recently Played</h3>
                        <div class="value" id="recent-count">—</div>
                    </div>
                </div>

                <div class="dashboard-section">
                    <div class="section-header">
                        <h2>Recently Played</h2>
                        <a class="view-all" data-nav="recent" style="cursor:pointer;">View All →</a>
                    </div>
                    <div class="songs-grid" id="recently-played-grid">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>
                </div>

                <div class="dashboard-section">
                    <div class="section-header">
                        <h2>Liked Songs</h2>
                        <a class="view-all" data-nav="liked" style="cursor:pointer;">View All →</a>
                    </div>
                    <div class="songs-grid" id="liked-songs-grid">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        this._wireNavButtons();
        if (!window.authService?.isAuthenticated?.()) return;
        await Promise.all([this._loadRecent(), this._loadLiked()]);
    }

    _wireNavButtons() {
        this._navButton = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return;
            el.addEventListener('click', () => {
                const dest = el.dataset.nav;
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(dest);
                else window.location.hash = dest;
            });
        };
        document.querySelectorAll('[data-nav]').forEach(el => {
            el.addEventListener('click', () => {
                const dest = el.dataset.nav;
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(dest);
                else window.location.hash = dest;
            });
        });
    }

    async _loadRecent() {
        const grid = document.getElementById('recently-played-grid');
        const count = document.getElementById('recent-count');
        if (!grid) return;

        let ids = [];
        try {
            const raw = JSON.parse(localStorage.getItem('bravo_history') || '[]');
            ids = (Array.isArray(raw) ? raw : [])
                .map(item => typeof item === 'string' ? item : item?._id)
                .filter(Boolean)
                .slice(0, 8);
        } catch { ids = []; }

        if (count) count.textContent = String(ids.length);

        if (ids.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>Nothing here yet — go listen!</p>
                </div>
            `;
            return;
        }

        const songs = await this._fetchByIds(ids);
        grid.innerHTML = '';
        if (songs.length === 0) {
            grid.innerHTML = '<p style="color:#888; padding:16px;">No songs available.</p>';
            return;
        }
        songs.forEach(song => new SongCard(song, grid, { playlist: songs }));
    }

    async _loadLiked() {
        const grid = document.getElementById('liked-songs-grid');
        const count = document.getElementById('liked-count');
        if (!grid) return;

        let ids = [];
        try {
            const raw = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
            ids = (Array.isArray(raw) ? raw : []).slice(0, 8);
        } catch { ids = []; }

        if (count) count.textContent = String(ids.length);

        if (ids.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart"></i>
                    <p>Heart songs to save them here.</p>
                </div>
            `;
            return;
        }

        const songs = await this._fetchByIds(ids);
        grid.innerHTML = '';
        if (songs.length === 0) {
            grid.innerHTML = '<p style="color:#888; padding:16px;">No songs available.</p>';
            return;
        }
        songs.forEach(song => new SongCard(song, grid, { playlist: songs }));
    }

    async _fetchByIds(ids) {
        const songsAPI = new SongsAPI();
        const results = await Promise.all(
            ids.map(id => songsAPI.getById(id).catch(() => null))
        );
        return results
            .map(r => (r?.success ? r.data : r))
            .filter(s => s && s._id);
    }
}

window.ListenerDashboardPage = ListenerDashboardPage;
