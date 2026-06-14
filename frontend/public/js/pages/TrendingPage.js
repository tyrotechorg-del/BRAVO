

class TrendingPage {
    constructor() {
        this.trendingSongs = [];
    }

    async render() {
        return `
            <div class="trending-container">
                <div class="page-header">
                    <h1><i class="fas fa-fire"></i> Trending Now</h1>
                    <p>Most popular songs on Bravo Music right now</p>
                </div>

                <div class="trending-stats">
                    <div class="stat-badge">
                        <i class="fas fa-chart-line"></i> Updated in real-time
                    </div>
                </div>

                <div class="songs-grid" id="trending-grid" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div><p>Loading trending songs...</p></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        await this._loadTrendingSongs();
    }

    async _loadTrendingSongs() {
        const grid = document.getElementById('trending-grid');
        if (!grid) return;

        try {
            const songsAPI = new SongsAPI();
            const trending = await songsAPI.getTrending();
            this.trendingSongs = Array.isArray(trending) ? trending : [];

            grid.innerHTML = '';

            if (this.trendingSongs.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-fire"></i>
                        <h3>No trending songs</h3>
                        <p>Check back soon for trending music.</p>
                    </div>
                `;
                return;
            }

            // SongCard's rank option adds a "#N" badge to the card.
            this.trendingSongs.forEach((song, index) => {
                new SongCard(song, grid, {
                    rank: index + 1,
                    playlist: this.trendingSongs
                });
            });
        } catch (err) {
            console.error('Load trending error:', err);
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load trending songs. Please try again.</p>
                </div>
            `;
        }
    }
}

window.TrendingPage = TrendingPage;
