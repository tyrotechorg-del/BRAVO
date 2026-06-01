/**
 * Home Page - With Bravo Logo
 */

class HomePage {
    constructor() {
        this.songs = [];
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        return `
            <div class="home-container">
                <div class="hero-section">
                    <div class="hero-content">
                        <div class="hero-logo">
                            <img src="${window.getDefaultImage()}" alt="Bravo Music" class="hero-logo-img">
                        </div>
                        <h1>Welcome to Bravo Music</h1>
                        <p>Zambia's Premier Music Platform</p>
                        <div class="hero-buttons">
                            <button class="btn-primary" onclick="window.bravoApp.navigateTo('browse')">Start Listening</button>
                            <button class="btn-outline" onclick="window.bravoApp.navigateTo('register')">Become an Artist</button>
                        </div>
                    </div>
                </div>
                
                <div class="popular-genres-section">
                    <div class="section-header">
                        <h2>Popular Genres</h2>
                        <a class="view-all" onclick="window.bravoApp.navigateTo('browse')">View All →</a>
                    </div>
                    <div class="genre-chips">
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('afrobeat')">Afrobeat</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('hip hop')">Hip Hop</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('cuundu')">Cuundu</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('kalindula')">Kalindula</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('gospel')">Gospel</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('amapiano')">Amapiano</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('dancehall')">Dancehall</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('reggae')">Reggae</span>
                        <span class="genre-chip" onclick="window.bravoApp.searchWithTerm('traditional')">Traditional</span>
                    </div>
                </div>
                
                <div class="featured-section">
                    <div class="section-header">
                        <h2>Featured This Week</h2>
                        <a class="view-all" onclick="window.bravoApp.navigateTo('browse')">View All →</a>
                    </div>
                    <div class="songs-grid" id="featured-grid">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>
                </div>
                
                <div class="trending-section">
                    <div class="section-header">
                        <h2>Trending Now</h2>
                        <a class="view-all" onclick="window.bravoApp.navigateTo('trending')">View All →</a>
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
                        <button class="btn-primary btn-large" onclick="window.bravoApp.navigateTo('register')">Start Your Journey</button>
                    </div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        await this.loadFeaturedSongs();
        await this.loadTrendingSongs();
    }

    getFullUrl(url) {
        if (!url) return window.getDefaultImage();
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    async loadFeaturedSongs() {
        const grid = document.getElementById('featured-grid');
        if (!grid) return;
        
        try {
            const songsAPI = new SongsAPI();
            const featured = await songsAPI.getFeatured();
            grid.innerHTML = '';
            featured.slice(0, 8).forEach(song => {
                song.coverArt = this.getFullUrl(song.coverArt);
                song.audioUrl = this.getFullUrl(song.audioUrl);
                const card = this.createSongCard(song);
                grid.appendChild(card);
            });
        } catch (error) {
            console.error('Failed to load featured songs:', error);
            grid.innerHTML = '<div class="error">Failed to load featured songs</div>';
        }
    }

    async loadTrendingSongs() {
        const grid = document.getElementById('home-trending-grid');
        if (!grid) return;
        
        try {
            const songsAPI = new SongsAPI();
            const trending = await songsAPI.getTrending();
            grid.innerHTML = '';
            trending.slice(0, 8).forEach(song => {
                song.coverArt = this.getFullUrl(song.coverArt);
                song.audioUrl = this.getFullUrl(song.audioUrl);
                const card = this.createSongCard(song);
                grid.appendChild(card);
            });
        } catch (error) {
            console.error('Failed to load trending songs:', error);
            grid.innerHTML = '<div class="error">Failed to load trending songs</div>';
        }
    }

    createSongCard(song) {
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(song._id);
        
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-song-id', song._id);
        card.innerHTML = `
            <img src="${song.coverArt}" alt="${this.escapeHtml(song.title)}" onerror="this.src='${window.getDefaultImage()}'">
            <div class="song-card-overlay">
                <button class="play-btn" title="Play"><i class="fas fa-play"></i></button>
                <button class="like-btn ${isLiked ? 'liked' : ''}" title="Like"><i class="fas fa-heart"></i></button>
            </div>
            <div class="song-card-info">
                <h4 class="song-title">${this.escapeHtml(song.title)}</h4>
                <p class="song-artist">${song.artist?.stageName || 'Unknown Artist'}</p>
                <div class="song-stats">
                    <span><i class="fas fa-play"></i> ${this.formatNumber(song.playCount || 0)}</span>
                </div>
            </div>
        `;
        
        card.querySelector('.play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.bravoApp && window.bravoApp.audioPlayer) {
                window.bravoApp.audioPlayer.loadSong(song);
            }
        });
        
        card.querySelector('.like-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.toggleLike(song);
            card.querySelector('.like-btn').classList.toggle('liked');
        });
        
        return card;
    }

    async toggleLike(song) {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            Toast.show('Please login to like songs', 'warning');
            window.location.hash = 'login';
            return;
        }
        
        const songsAPI = new SongsAPI();
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(song._id);
        
        if (isLiked) {
            await songsAPI.unlike(song._id);
            const newLiked = likedSongs.filter(id => id !== song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
            Toast.show('Removed from liked songs', 'info');
        } else {
            await songsAPI.like(song._id);
            likedSongs.push(song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
            Toast.show('Added to liked songs! ❤️', 'success');
        }
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

window.HomePage = HomePage;