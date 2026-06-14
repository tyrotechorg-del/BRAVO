

class RecentPage {
    constructor() {
        this.recentSongs = [];
        this.loading = true;
    }

    async render() {
        return `
            <div class="browse-container">
                <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1><i class="fas fa-history"></i> Recently Played</h1>
                        <p id="recent-count" style="color:#888;"></p>
                    </div>
                    <button class="btn-outline" type="button" id="clear-history-btn" style="display:none;">
                        <i class="fas fa-trash"></i> Clear History
                    </button>
                </div>
                <div class="songs-grid" id="recent-grid" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        await this._loadRecent();
        this._renderGrid();
        this._wireClearButton();
    }

    async _loadRecent() {
        const ids = this._getHistoryIds();

        if (ids.length === 0) {
            this.recentSongs = [];
            this.loading = false;
            return;
        }

        const songsAPI = new SongsAPI();
        const results = await Promise.all(
            ids.map(id => songsAPI.getById(id).catch(() => null))
        );

        // Preserve order; filter out nulls.
        const valid = [];
        const validIds = [];
        results.forEach((song, idx) => {
            const songData = song?.success ? song.data : song;
            if (songData && songData._id) {
                valid.push(songData);
                validIds.push(ids[idx]);
            }
        });

        this.recentSongs = valid;
        this.loading = false;

        // Write back the cleaned, normalized (IDs-only) list.
        if (validIds.length !== ids.length || !this._isAlreadyIdFormat()) {
            localStorage.setItem('bravo_history', JSON.stringify(validIds));
        }
    }

    _getHistoryIds() {
        try {
            const raw = JSON.parse(localStorage.getItem('bravo_history') || '[]');
            if (!Array.isArray(raw)) return [];
            // Tolerate old (object) format AND new (string ID) format.
            return raw
                .map(item => (typeof item === 'string' ? item : item?._id))
                .filter(Boolean);
        } catch {
            return [];
        }
    }

    _isAlreadyIdFormat() {
        try {
            const raw = JSON.parse(localStorage.getItem('bravo_history') || '[]');
            return Array.isArray(raw) && raw.every(x => typeof x === 'string');
        } catch {
            return true;
        }
    }

    _renderGrid() {
        const grid = document.getElementById('recent-grid');
        const count = document.getElementById('recent-count');
        const clearBtn = document.getElementById('clear-history-btn');
        if (!grid) return;

        if (this.recentSongs.length === 0) {
            if (count) count.textContent = '';
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No history yet</h3>
                    <p>Songs you play will appear here.</p>
                    <button class="btn-primary" type="button" id="recent-discover-btn">Discover Music</button>
                </div>
            `;
            document.getElementById('recent-discover-btn')?.addEventListener('click', () => {
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('browse');
                else window.location.hash = 'browse';
            });
            return;
        }

        if (count) {
            count.textContent = `${this.recentSongs.length} song${this.recentSongs.length === 1 ? '' : 's'}`;
        }
        if (clearBtn) clearBtn.style.display = 'inline-flex';

        grid.innerHTML = '';
        this.recentSongs.forEach(song => {
            new SongCard(song, grid, { playlist: this.recentSongs });
        });
    }

    _wireClearButton() {
        const btn = document.getElementById('clear-history-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (!window.Modal) {
                // Fallback to confirm if Modal isn't available
                if (!confirm('Clear all listening history?')) return;
                this._clearHistory();
                return;
            }
            Modal.confirm('Clear all listening history?', () => this._clearHistory());
        });
    }

    _clearHistory() {
        localStorage.setItem('bravo_history', '[]');
        this.recentSongs = [];
        this._renderGrid();
        Toast.show?.('History cleared', 'success');
    }
}

window.RecentPage = RecentPage;
