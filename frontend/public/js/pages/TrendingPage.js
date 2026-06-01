/**
 * Trending Page - FIXED
 */

class TrendingPage {
    constructor() {
        this.trendingSongs = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        await this.loadTrendingSongs();
        
        return `
            <div class="trending-container">
                <div class="page-header">
                    <h1><i class="fas fa-fire"></i> Trending Now</h1>
                    <p>Most popular songs on Bravo Music right now</p>
                </div>
                
                <div class="trending-stats" id="trending-stats">
                    <div class="stat-badge">
                        <i class="fas fa-chart-line"></i> Updated in real-time
                    </div>
                </div>
                
                <div class="songs-grid" id="trending-grid">
                    ${this.renderContent()}
                </div>
                
                <div class="pagination" id="trending-pagination"></div>
            </div>
        `;
    }

    async loadTrendingSongs() {
        try {
            const songsAPI = new SongsAPI();
            const trending = await songsAPI.getTrending();
            this.trendingSongs = trending || [];
        } catch (error) {
            console.error('Load trending error:', error);
            this.trendingSongs = [];
        }
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    renderContent() {
        if (this.trendingSongs.length === 0) {
            return '<div class="empty-state"><i class="fas fa-fire"></i><h3>No trending songs</h3><p>Check back soon for trending music</p></div>';
        }
        return '';
    }

    async afterRender() {
        this.renderTrendingSongs();
    }

    renderTrendingSongs() {
        const grid = document.getElementById('trending-grid');
        if (!grid) return;
        
        if (this.trendingSongs.length === 0) return;
        
        grid.innerHTML = '';
        this.trendingSongs.forEach((song, index) => {
            const songWithFullUrl = {
                ...song,
                coverArt: this.getFullUrl(song.coverArt),
                audioUrl: this.getFullUrl(song.audioUrl)
            };
            const card = this.createTrendingCard(songWithFullUrl, index + 1);
            grid.appendChild(card);
        });
    }

    createTrendingCard(song, rank) {
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(song._id);
        
        const card = document.createElement('div');
        card.className = 'song-card trending-card';
        card.setAttribute('data-song-id', song._id);
        card.innerHTML = `
            <div class="trending-rank">#${rank}</div>
            <img src="${song.coverArt}" alt="${this.escapeHtml(song.title)}" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'">
            <div class="song-card-overlay">
                <button class="play-btn" title="Play"><i class="fas fa-play"></i></button>
                <button class="like-btn ${isLiked ? 'liked' : ''}" title="Like"><i class="fas fa-heart"></i></button>
            </div>
            <div class="song-card-info">
                <h4 class="song-title">${this.escapeHtml(song.title)}</h4>
                <p class="song-artist">${song.artist?.stageName || 'Unknown Artist'}</p>
                <div class="song-stats">
                    <span><i class="fas fa-play"></i> ${this.formatNumber(song.playCount || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${this.formatNumber(song.likeCount || 0)}</span>
                </div>
            </div>
        `;
        
        const playBtn = card.querySelector('.play-btn');
        const likeBtn = card.querySelector('.like-btn');
        
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.bravoApp && window.bravoApp.audioPlayer) {
                    window.bravoApp.audioPlayer.loadSong(song);
                }
            });
        }
        
        if (likeBtn) {
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const songsAPI = new SongsAPI();
                if (isLiked) {
                    await songsAPI.unlike(song._id);
                    const newLiked = likedSongs.filter(id => id !== song._id);
                    localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
                    likeBtn.classList.remove('liked');
                    Toast.show('Removed from liked songs', 'info');
                } else {
                    await songsAPI.like(song._id);
                    likedSongs.push(song._id);
                    localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
                    likeBtn.classList.add('liked');
                    Toast.show('Added to liked songs! ❤️', 'success');
                }
            });
        }
        
        card.addEventListener('click', () => {
            window.location.hash = `song/${song._id}`;
        });
        
        return card;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.TrendingPage = TrendingPage;