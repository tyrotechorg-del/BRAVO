/**
 * Liked Songs Page
 */

class LikedPage {
    constructor() {
        this.likedSongs = [];
    }

    async render() {
        this.loadLikedSongs();
        
        return `
            <div class="browse-container">
                <h1>Liked Songs</h1>
                <div class="songs-grid" id="liked-grid">
                    ${this.renderContent()}
                </div>
            </div>
        `;
    }

    loadLikedSongs() {
        const likedIds = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        if (window.bravoApp && window.bravoApp.songs) {
            this.likedSongs = window.bravoApp.songs.filter(s => likedIds.includes(s._id));
        }
    }

    renderContent() {
        if (this.likedSongs.length === 0) {
            return '<div class="empty-state"><i class="fas fa-heart"></i><h3>No liked songs</h3><p>Heart songs to add them to your library</p><button class="btn-primary" onclick="window.bravoApp.navigateTo(\'browse\')">Discover Music</button></div>';
        }
        return '';
    }

    async afterRender() {
        this.renderLikedSongs();
    }

    renderLikedSongs() {
        const grid = document.getElementById('liked-grid');
        if (!grid) return;
        
        if (this.likedSongs.length === 0) return;
        
        grid.innerHTML = '';
        this.likedSongs.forEach(song => {
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
                <button class="like-btn ${isLiked ? 'liked' : ''}" title="Unlike"><i class="fas fa-heart"></i></button>
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
            await songsAPI.unlike(song._id);
            const newLiked = likedSongs.filter(id => id !== song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
            card.remove();
            Toast.show('Removed from liked songs', 'info');
            
            if (document.getElementById('liked-grid').children.length === 0) {
                document.getElementById('liked-grid').innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><h3>No liked songs</h3><p>Heart songs to add them to your library</p><button class="btn-primary" onclick="window.bravoApp.navigateTo(\'browse\')">Discover Music</button></div>';
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

window.LikedPage = LikedPage;