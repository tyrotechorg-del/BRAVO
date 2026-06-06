/**
 * Song Detail Page - With Genre Display
 */

class SongDetailPage {
    constructor(songId) {
        this.songId = songId;
        this.song = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
        this.apiUrl = window.API_BASE_URL;
    }

    async render() {
        await this.loadSong();
        
        if (!this.song) {
            return '<div class="error">Song not found</div>';
        }
        
        const coverUrl = this.getFullUrl(this.song.coverArt);
        const audioUrl = this.getFullUrl(this.song.audioUrl);
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(this.song._id);
        
        return `
            <div class="song-detail-container">
                <div class="song-detail-header">
                    <img src="${coverUrl}" alt="${this.escapeHtml(this.song.title)}" class="song-detail-cover">
                    <div class="song-detail-info">
                        <h1>${this.escapeHtml(this.song.title)}</h1>
                        <p class="song-detail-artist">
                            <i class="fas fa-user"></i> ${this.song.artist?.stageName || 'Unknown Artist'}
                        </p>
                        <div class="song-detail-stats">
                            <span><i class="fas fa-tag"></i> ${this.escapeHtml(this.song.genre || 'Various')}</span>
                            <span><i class="fas fa-play"></i> ${this.formatNumber(this.song.playCount || 0)} plays</span>
                            <span><i class="fas fa-heart"></i> ${this.formatNumber(this.song.likeCount || 0)} likes</span>
                            <span><i class="fas fa-download"></i> ${this.formatNumber(this.song.downloadCount || 0)} downloads</span>
                            <span><i class="fas fa-share"></i> ${this.formatNumber(this.song.shareCount || 0)} shares</span>
                        </div>
                        <div class="song-detail-actions">
                            <button class="btn-primary play-song-btn" id="play-song-btn">
                                <i class="fas fa-play"></i> Play Now
                            </button>
                            <button class="btn-outline like-song-btn ${isLiked ? 'liked' : ''}" id="like-song-btn">
                                <i class="fas fa-heart"></i> ${isLiked ? 'Liked' : 'Like'}
                            </button>
                            <button class="btn-outline download-song-btn" id="download-song-btn">
                                <i class="fas fa-download"></i> Download
                            </button>
                            <button class="btn-outline share-song-btn" id="share-song-btn">
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                        </div>
                    </div>
                </div>
                
                ${this.song.genre === 'Cuundu' || this.song.genre === 'Kalindula' ? `
                    <div class="genre-badge-large ${this.song.genre.toLowerCase()}">
                        <i class="fas fa-music"></i> ${this.song.genre} Music - Traditional Zambian Sound
                    </div>
                ` : ''}
                
                <div class="song-lyrics" id="song-lyrics" style="display: ${this.song.lyrics ? 'block' : 'none'}">
                    <h3>Lyrics</h3>
                    <div class="lyrics-content">${this.escapeHtml(this.song.lyrics || '').replace(/\n/g, '<br>')}</div>
                </div>
                
                <div class="song-comments">
                    <h3>Comments</h3>
                    <div id="comment-section-container"></div>
                </div>
            </div>
        `;
    }

    async loadSong() {
        try {
            const songsAPI = new SongsAPI();
            this.song = await songsAPI.getById(this.songId);
        } catch (error) {
            console.error('Load song error:', error);
            this.song = null;
        }
    }

    async afterRender() {
        const playBtn = document.getElementById('play-song-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (window.bravoApp && window.bravoApp.audioPlayer) {
                    const songWithFullUrl = {
                        ...this.song,
                        audioUrl: this.getFullUrl(this.song.audioUrl),
                        coverArt: this.getFullUrl(this.song.coverArt)
                    };
                    window.bravoApp.audioPlayer.loadSong(songWithFullUrl);
                }
            });
        }
        
        const likeBtn = document.getElementById('like-song-btn');
        if (likeBtn) {
            likeBtn.addEventListener('click', async () => {
                // Like/Unlike without login - store in localStorage only
                const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
                const isLiked = likedSongs.includes(this.song._id);
                
                if (isLiked) {
                    const newLiked = likedSongs.filter(id => id !== this.song._id);
                    localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
                    likeBtn.innerHTML = '<i class="fas fa-heart"></i> Like';
                    likeBtn.classList.remove('liked');
                    Toast.show('Removed from liked songs', 'info');
                } else {
                    likedSongs.push(this.song._id);
                    localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
                    likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
                    likeBtn.classList.add('liked');
                    Toast.show('Added to liked songs! ❤️', 'success');
                }
            });
        }
        
        const downloadBtn = document.getElementById('download-song-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                // Download without login
                Toast.show(`Downloading "${this.song.title}"...`, 'info');
                
                try {
                    let audioUrl = this.song.audioUrl;
                    if (audioUrl && !audioUrl.startsWith('http') && audioUrl.startsWith('/uploads')) {
                        audioUrl = `${this.staticUrl}${audioUrl}`;
                    }
                    
                    const response = await fetch(audioUrl);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${this.song.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    
                    Toast.show(`Downloaded "${this.song.title}"! 📥`, 'success');
                } catch (error) {
                    Toast.show('Download failed', 'error');
                }
            });
        }
        
        const shareBtn = document.getElementById('share-song-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                ShareModal.show(this.song);
            });
        }
        
        const commentContainer = document.getElementById('comment-section-container');
        if (commentContainer) {
            new CommentSection(this.songId, '#comment-section-container');
        }
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
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

window.SongDetailPage = SongDetailPage;