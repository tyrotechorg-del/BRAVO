/**
 * Listener Dashboard Page
 */

class ListenerDashboardPage {
    constructor() {
        this.recentlyPlayed = [];
        this.likedSongs = [];
    }

    async render() {
        await this.loadData();
        
        return `
            <div class="dashboard-container">
                <h1>Your Library</h1>
                
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <h3>Liked Songs</h3>
                        <div class="value">${this.likedSongs.length}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Recently Played</h3>
                        <div class="value">${this.recentlyPlayed.length}</div>
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <h2>Recently Played</h2>
                    <div class="songs-grid" id="recently-played-grid">
                        ${this.recentlyPlayed.length === 0 ? '<div class="empty-state"><i class="fas fa-history"></i><h3>No recent songs</h3><p>Start listening to build your history</p></div>' : ''}
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <h2>Liked Songs</h2>
                    <div class="songs-grid" id="liked-songs-grid">
                        ${this.likedSongs.length === 0 ? '<div class="empty-state"><i class="fas fa-heart"></i><h3>No liked songs</h3><p>Heart songs to add them to your library</p></div>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        const recent = localStorage.getItem('bravo_history');
        if (recent) {
            this.recentlyPlayed = JSON.parse(recent);
        }
        
        const likedIds = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        if (window.bravoApp && window.bravoApp.songs) {
            this.likedSongs = window.bravoApp.songs.filter(s => likedIds.includes(s._id));
        }
    }

    async afterRender() {
        this.renderRecentlyPlayed();
        this.renderLikedSongs();
    }

    renderRecentlyPlayed() {
        const grid = document.getElementById('recently-played-grid');
        if (!grid || this.recentlyPlayed.length === 0) return;
        
        grid.innerHTML = '';
        this.recentlyPlayed.slice(0, 8).forEach(item => {
            const song = window.bravoApp?.songs?.find(s => s._id === item._id);
            if (song) {
                const card = this.createSongCard(song);
                grid.appendChild(card);
            }
        });
    }

    renderLikedSongs() {
        const grid = document.getElementById('liked-songs-grid');
        if (!grid || this.likedSongs.length === 0) return;
        
        grid.innerHTML = '';
        this.likedSongs.slice(0, 8).forEach(song => {
            const card = this.createSongCard(song);
            grid.appendChild(card);
        });
    }

    createSongCard(song) {
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(song._id);
        
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-song-id', song._id);
        card.innerHTML = `
            <img src="${song.coverArt || 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'}" alt="${this.escapeHtml(song.title)}">
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
        
        const playBtn = card.querySelector('.play-btn');
        const likeBtn = card.querySelector('.like-btn');
        
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.bravoApp && window.bravoApp.audioPlayer) {
                window.bravoApp.audioPlayer.loadSong(song);
            }
        });
        
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

window.ListenerDashboardPage = ListenerDashboardPage;