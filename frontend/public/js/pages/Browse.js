/**
 * Browse Page - WITH ALL GENRES INCLUDING CUUNDU & KALINDULA
 */

class BrowsePage {
    constructor() {
        this.currentGenre = 'all';
        this.currentPage = 1;
        this.totalPages = 1;
        this.songs = [];
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    async render() {
        return `
            <div class="browse-container">
                <div class="browse-header">
                    <h1>Browse Music</h1>
                    <p>Discover new music across all genres</p>
                </div>
                
                <div class="genre-filters">
                    <button class="genre-filter ${this.currentGenre === 'all' ? 'active' : ''}" data-genre="all">All</button>
                    <button class="genre-filter ${this.currentGenre === 'Afrobeat' ? 'active' : ''}" data-genre="Afrobeat">Afrobeat</button>
                    <button class="genre-filter ${this.currentGenre === 'Hip Hop' ? 'active' : ''}" data-genre="Hip Hop">Hip Hop</button>
                    <button class="genre-filter ${this.currentGenre === 'R&B' ? 'active' : ''}" data-genre="R&B">R&B</button>
                    <button class="genre-filter ${this.currentGenre === 'Dancehall' ? 'active' : ''}" data-genre="Dancehall">Dancehall</button>
                    <button class="genre-filter ${this.currentGenre === 'Reggae' ? 'active' : ''}" data-genre="Reggae">Reggae</button>
                    <button class="genre-filter ${this.currentGenre === 'Gospel' ? 'active' : ''}" data-genre="Gospel">Gospel</button>
                    <button class="genre-filter ${this.currentGenre === 'Traditional' ? 'active' : ''}" data-genre="Traditional">Traditional</button>
                    <button class="genre-filter ${this.currentGenre === 'Amapiano' ? 'active' : ''}" data-genre="Amapiano">Amapiano</button>
                    <button class="genre-filter ${this.currentGenre === 'Cuundu' ? 'active' : ''}" data-genre="Cuundu">Cuundu</button>
                    <button class="genre-filter ${this.currentGenre === 'Kalindula' ? 'active' : ''}" data-genre="Kalindula">Kalindula</button>
                    <button class="genre-filter ${this.currentGenre === 'House' ? 'active' : ''}" data-genre="House">House</button>
                    <button class="genre-filter ${this.currentGenre === 'Pop' ? 'active' : ''}" data-genre="Pop">Pop</button>
                    <button class="genre-filter ${this.currentGenre === 'Rock' ? 'active' : ''}" data-genre="Rock">Rock</button>
                    <button class="genre-filter ${this.currentGenre === 'Jazz' ? 'active' : ''}" data-genre="Jazz">Jazz</button>
                    <button class="genre-filter ${this.currentGenre === 'Soul' ? 'active' : ''}" data-genre="Soul">Soul</button>
                </div>
                
                <div class="songs-grid" id="browse-grid">
                    <div class="loading-container"><div class="spinner"></div><p>Loading songs...</p></div>
                </div>
                <div class="pagination" id="pagination"></div>
            </div>
        `;
    }

    async afterRender() {
        await this.loadSongs();
        this.attachEventListeners();
    }

    attachEventListeners() {
        document.querySelectorAll('.genre-filter').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.genre-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentGenre = e.target.dataset.genre;
                this.currentPage = 1;
                await this.loadSongs();
            });
        });
    }

    async loadSongs() {
        const grid = document.getElementById('browse-grid');
        if (!grid) return;
        
        grid.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading songs...</p></div>';
        
        try {
            const songsAPI = new SongsAPI();
            const result = await songsAPI.getAll(this.currentPage, 20, this.currentGenre);
            this.songs = result.songs || [];
            this.totalPages = result.totalPages || 1;
            
            grid.innerHTML = '';
            
            if (this.songs.length === 0) {
                grid.innerHTML = '<div class="empty-state"><i class="fas fa-music"></i><h3>No songs found</h3><p>Try a different genre</p></div>';
                return;
            }
            
            this.songs.forEach(song => {
                if (song.coverArt) {
                    song.coverArt = this.getFullUrl(song.coverArt);
                }
                if (song.audioUrl) {
                    song.audioUrl = this.getFullUrl(song.audioUrl);
                }
                
                const card = this.createSongCard(song);
                grid.appendChild(card);
            });
            
            this.renderPagination();
        } catch (error) {
            console.error('Load songs error:', error);
            grid.innerHTML = '<div class="error">Failed to load songs</div>';
        }
    }

    createSongCard(song) {
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(song._id);
        const isDownloaded = this.isSongDownloaded(song._id);
        
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-song-id', song._id);
        card.innerHTML = `
            <img src="${song.coverArt}" 
                 alt="${this.escapeHtml(song.title)}" 
                 onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'">
            <div class="song-card-overlay">
                <button class="play-btn" title="Play"><i class="fas fa-play"></i></button>
                <button class="like-btn ${isLiked ? 'liked' : ''}" title="Like"><i class="fas fa-heart"></i></button>
                <button class="download-btn ${isDownloaded ? 'downloaded' : ''}" title="${isDownloaded ? 'Downloaded' : 'Download'}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="share-btn" title="Share"><i class="fas fa-share-alt"></i></button>
            </div>
            <div class="song-card-info">
                <h4 class="song-title">${this.escapeHtml(song.title)}</h4>
                <p class="song-artist">${song.artist?.stageName || 'Unknown Artist'}</p>
                <div class="song-stats">
                    <span><i class="fas fa-play"></i> ${this.formatNumber(song.playCount || 0)}</span>
                    <span><i class="fas fa-tag"></i> ${song.genre || 'Various'}</span>
                    ${isDownloaded ? '<span class="downloaded-badge"><i class="fas fa-check"></i> Downloaded</span>' : ''}
                </div>
            </div>
        `;
        
        const playBtn = card.querySelector('.play-btn');
        const likeBtn = card.querySelector('.like-btn');
        const downloadBtn = card.querySelector('.download-btn');
        const shareBtn = card.querySelector('.share-btn');
        
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
                await this.toggleLike(song);
                likeBtn.classList.toggle('liked');
            });
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.downloadSong(song);
                downloadBtn.classList.add('downloaded');
                downloadBtn.title = 'Downloaded';
                const badge = card.querySelector('.downloaded-badge');
                if (!badge) {
                    const statsDiv = card.querySelector('.song-stats');
                    if (statsDiv) {
                        statsDiv.innerHTML += '<span class="downloaded-badge"><i class="fas fa-check"></i> Downloaded</span>';
                    }
                }
            });
        }
        
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                ShareModal.show(song);
            });
        }
        
        card.addEventListener('click', () => {
            window.location.hash = `song/${song._id}`;
        });
        
        return card;
    }

    async toggleLike(song) {
        // Like/Unlike without login - store in localStorage only
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(song._id);
        
        if (isLiked) {
            const newLiked = likedSongs.filter(id => id !== song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
            Toast.show('Removed from liked songs', 'info');
        } else {
            likedSongs.push(song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
            Toast.show('Added to liked songs! ❤️', 'success');
        }
    }

    async downloadSong(song) {
        // Download without login
        Toast.show(`Downloading "${song.title}"...`, 'info');
        
        try {
            let audioUrl = song.audioUrl;
            if (audioUrl && !audioUrl.startsWith('http') && audioUrl.startsWith('/uploads')) {
                audioUrl = `${this.staticUrl}${audioUrl}`;
            }
            
            const response = await fetch(audioUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${song.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.saveToDownloads(song);
            Toast.show(`Downloaded "${song.title}" successfully! 📥`, 'success');
        } catch (error) {
            console.error('Download failed:', error);
            Toast.show('Download failed. Please try again.', 'error');
        }
    }

    saveToDownloads(song) {
        let downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
        
        if (!downloads.some(d => d._id === song._id)) {
            downloads.unshift({
                _id: song._id,
                title: song.title,
                artist: song.artist,
                coverArt: song.coverArt,
                downloadedAt: new Date().toISOString(),
                duration: song.duration
            });
            downloads = downloads.slice(0, 50);
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(downloads));
        }
    }

    isSongDownloaded(songId) {
        const downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
        return downloads.some(d => d._id === songId);
    }

    renderPagination() {
        const container = document.getElementById('pagination');
        if (!container) return;
        
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<div class="pagination-controls">';
        
        if (this.currentPage > 1) {
            html += `<button class="page-btn" data-page="${this.currentPage - 1}"><i class="fas fa-chevron-left"></i> Previous</button>`;
        }
        
        html += `<span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>`;
        
        if (this.currentPage < this.totalPages) {
            html += `<button class="page-btn" data-page="${this.currentPage + 1}">Next <i class="fas fa-chevron-right"></i></button>`;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        container.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                this.currentPage = parseInt(btn.dataset.page);
                await this.loadSongs();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
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

window.BrowsePage = BrowsePage;