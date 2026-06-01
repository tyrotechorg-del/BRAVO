/**
 * Album View Page
 */

class AlbumView {
    constructor(albumId) {
        this.albumId = albumId;
        this.album = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        await this.loadAlbum();
        
        if (!this.album) {
            return '<div class="error">Album not found</div>';
        }
        
        return `
            <div class="album-view-container">
                <div class="album-header">
                    <img src="${this.getFullUrl(this.album.coverArt)}" alt="${this.album.title}" class="album-cover-large">
                    <div class="album-header-info">
                        <h1>${this.escapeHtml(this.album.title)}</h1>
                        <p class="album-artist">${this.album.artist?.stageName || 'Unknown Artist'}</p>
                        <p class="album-details">${this.album.songs?.length || 0} tracks</p>
                        <button class="btn-primary play-all-btn">
                            <i class="fas fa-play"></i> Play All
                        </button>
                    </div>
                </div>
                
                <div class="album-tracks">
                    <h2>Tracklist</h2>
                    <div class="tracks-list" id="album-tracks-list"></div>
                </div>
            </div>
        `;
    }

    async loadAlbum() {
        try {
            const albumsAPI = new AlbumsAPI();
            this.album = await albumsAPI.getById(this.albumId);
        } catch (error) {
            console.error('Load album error:', error);
            this.album = null;
        }
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    async afterRender() {
        this.renderTracks();
        
        const playAllBtn = document.querySelector('.play-all-btn');
        if (playAllBtn) {
            playAllBtn.addEventListener('click', () => this.playAllSongs());
        }
    }

    renderTracks() {
        const container = document.getElementById('album-tracks-list');
        if (!container || !this.album.songs) return;
        
        container.innerHTML = this.album.songs.map((song, index) => `
            <div class="track-item" data-song-id="${song._id}">
                <div class="track-number">${index + 1}</div>
                <div class="track-info">
                    <div class="track-title">${this.escapeHtml(song.title)}</div>
                    <div class="track-duration">${this.formatDuration(song.duration)}</div>
                </div>
                <div class="track-actions">
                    <button class="play-track-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.play-track-btn').forEach((btn, idx) => {
            btn.addEventListener('click', () => {
                const song = this.album.songs[idx];
                if (song && window.bravoApp && window.bravoApp.audioPlayer) {
                    const songWithFullUrl = {
                        ...song,
                        audioUrl: this.getFullUrl(song.audioUrl),
                        coverArt: this.getFullUrl(song.coverArt)
                    };
                    window.bravoApp.audioPlayer.loadSong(songWithFullUrl, this.album.songs);
                }
            });
        });
    }

    playAllSongs() {
        if (this.album.songs && this.album.songs.length > 0 && window.bravoApp && window.bravoApp.audioPlayer) {
            const firstSong = {
                ...this.album.songs[0],
                audioUrl: this.getFullUrl(this.album.songs[0].audioUrl),
                coverArt: this.getFullUrl(this.album.songs[0].coverArt)
            };
            window.bravoApp.audioPlayer.loadSong(firstSong, this.album.songs);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

window.AlbumView = AlbumView;