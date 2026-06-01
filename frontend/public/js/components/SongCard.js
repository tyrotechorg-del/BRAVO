/**
 * Song Card Component - WITH DOWNLOAD AND SHARE BUTTONS FIXED
 */

class SongCard {
    constructor(song, container, onPlay) {
        this.song = song;
        this.container = container;
        this.onPlay = onPlay;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
        this.render();
    }

    getFullUrl(url) {
        if (!url) return window.getDefaultImage();
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    render() {
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(this.song._id);
        const isDownloaded = this.isSongDownloaded();
        
        const coverUrl = this.getFullUrl(this.song.coverArt) || window.getDefaultImage();
        const audioUrl = this.getFullUrl(this.song.audioUrl);
        
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-song-id', this.song._id);
        card.innerHTML = `
            <img src="${coverUrl}" alt="${this.escapeHtml(this.song.title)}" onerror="this.src='${window.getDefaultImage()}'">
            <div class="song-card-overlay">
                <button class="play-btn" title="Play"><i class="fas fa-play"></i></button>
                <button class="like-btn ${isLiked ? 'liked' : ''}" title="Like"><i class="fas fa-heart"></i></button>
                <button class="download-btn ${isDownloaded ? 'downloaded' : ''}" title="${isDownloaded ? 'Downloaded' : 'Download'}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="share-btn" title="Share"><i class="fas fa-share-alt"></i></button>
            </div>
            <div class="song-card-info">
                <h4 class="song-title">${this.escapeHtml(this.song.title)}</h4>
                <p class="song-artist">${this.song.artist?.stageName || 'Unknown Artist'}</p>
                <div class="song-stats">
                    <span><i class="fas fa-play"></i> ${this.formatNumber(this.song.playCount || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${this.formatNumber(this.song.likeCount || 0)}</span>
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
                const songWithFullUrl = {
                    ...this.song,
                    audioUrl: audioUrl,
                    coverArt: coverUrl
                };
                if (this.onPlay) this.onPlay(songWithFullUrl);
            });
        }
        
        if (likeBtn) {
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleLike();
                likeBtn.classList.toggle('liked');
            });
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.downloadSong();
                downloadBtn.classList.add('downloaded');
                downloadBtn.title = 'Downloaded';
            });
        }
        
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                ShareModal.show(this.song);
            });
        }
        
        card.addEventListener('click', () => {
            window.location.hash = `song/${this.song._id}`;
        });
        
        this.container.appendChild(card);
    }

    async toggleLike() {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            Toast.show('Please login to like songs', 'info');
            window.location.hash = 'login';
            return;
        }
        
        const songsAPI = new SongsAPI();
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(this.song._id);
        
        if (isLiked) {
            await songsAPI.unlike(this.song._id);
            const newLiked = likedSongs.filter(id => id !== this.song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
            Toast.show('Removed from liked songs', 'info');
        } else {
            await songsAPI.like(this.song._id);
            likedSongs.push(this.song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
            Toast.show('Added to liked songs! ❤️', 'success');
        }
    }

    async downloadSong() {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            Toast.show('Please login to download', 'info');
            window.location.hash = 'login';
            return;
        }
        
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
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.saveToDownloads();
            Toast.show(`Downloaded "${this.song.title}" successfully! 📥`, 'success');
        } catch (error) {
            console.error('Download failed:', error);
            Toast.show('Download failed. Please try again.', 'error');
        }
    }

    saveToDownloads() {
        let downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
        
        if (!downloads.some(d => d._id === this.song._id)) {
            downloads.unshift({
                _id: this.song._id,
                title: this.song.title,
                artist: this.song.artist,
                coverArt: this.song.coverArt,
                downloadedAt: new Date().toISOString(),
                duration: this.song.duration
            });
            downloads = downloads.slice(0, 50);
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(downloads));
        }
    }

    isSongDownloaded() {
        const downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
        return downloads.some(d => d._id === this.song._id);
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

window.SongCard = SongCard;