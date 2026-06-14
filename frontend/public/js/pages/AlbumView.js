/**
 * Album View Page
 */

class AlbumView {
    constructor(albumId) {
        this.albumId = albumId;
        this.album = null;
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
    }

    async render() {
        await this._loadAlbum();

        if (!this.album) {
            return `
                <div class="album-view-container">
                    <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                        <i class="fas fa-compact-disc" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                        <h2>Album not found</h2>
                        <p style="color: #888; margin-bottom: 24px;">
                            This album may have been removed or the link is incorrect.
                        </p>
                        <button class="btn-primary" type="button" data-nav="browse">Browse Music</button>
                    </div>
                </div>
            `;
        }

        const a = this.album;
        const safeTitle = this._escapeHtml(a.title);
        const safeArtist = this._escapeHtml(a.artist?.stageName || 'Unknown Artist');
        const trackCount = Array.isArray(a.songs) ? a.songs.length : 0;
        const releaseYear = a.releaseDate ? new Date(a.releaseDate).getFullYear() : null;
        const safeBio = a.description ? this._escapeHtml(a.description) : null;

        return `
            <div class="album-view-container">
                <div class="album-header">
                    <img class="album-cover-large" alt="${safeTitle}" id="album-cover">
                    <div class="album-header-info">
                        <h1>${safeTitle}</h1>
                        <p class="album-artist">${safeArtist}</p>
                        <p class="album-details">
                            ${trackCount} track${trackCount === 1 ? '' : 's'}
                            ${releaseYear ? ` &middot; ${releaseYear}` : ''}
                        </p>
                        <button class="btn-primary play-all-btn" type="button" ${trackCount === 0 ? 'disabled' : ''}>
                            <i class="fas fa-play"></i> Play All
                        </button>
                    </div>
                </div>

                ${safeBio ? `<div class="album-description"><p>${safeBio}</p></div>` : ''}

                <div class="album-tracks">
                    <h2>Tracklist</h2>
                    <div class="tracks-list" id="album-tracks-list">
                        ${this._renderTracks()}
                    </div>
                </div>
            </div>
        `;
    }

    async _loadAlbum() {
        try {
            const albumsAPI = new AlbumsAPI();
            const result = await albumsAPI.getById(this.albumId);
            this.album = result || null;
        } catch (err) {
            console.error('Load album error:', err);
            this.album = null;
        }
    }

    _renderTracks() {
        const songs = this.album?.songs || [];
        if (songs.length === 0) {
            return `
                <div class="empty-state">
                    <p>No tracks in this album yet.</p>
                </div>
            `;
        }

        return songs.map((song, index) => {
            const safeTitle = this._escapeHtml(song.title || 'Untitled');
            const duration = this._formatDuration(song.duration);
            const isPremium = song.isPremium === true;
            return `
                <div class="track-item" data-song-id="${this._escapeHtml(song._id)}" data-index="${index}">
                    <div class="track-number">${index + 1}</div>
                    <div class="track-info">
                        <div class="track-title">
                            ${safeTitle}
                            ${isPremium ? '<i class="fas fa-crown" style="color: #ffc107; margin-left: 6px;" title="Premium"></i>' : ''}
                        </div>
                        <div class="track-duration">${duration}</div>
                    </div>
                    <div class="track-actions">
                        <button class="play-track-btn" type="button" data-action="play" data-index="${index}" aria-label="Play ${safeTitle}">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async afterRender() {
        if (!this.album) {
            // Wire the "Browse Music" button on the not-found screen.
            const navBtn = document.querySelector('[data-nav="browse"]');
            if (navBtn) {
                navBtn.addEventListener('click', () => {
                    if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('browse');
                    else window.location.hash = 'browse';
                });
            }
            return;
        }

        // Cover image with fallback on error
        const cover = document.getElementById('album-cover');
        if (cover) {
            cover.src = this._getFullUrl(this.album.coverArt);
            cover.addEventListener('error', () => {
                cover.src = window.getDefaultImage?.() || '/js/images/bravo.png';
            }, { once: true });
        }

        const playAll = document.querySelector('.play-all-btn');
        if (playAll) {
            playAll.addEventListener('click', () => this._playAll());
        }

        // Delegated handler for per-track play buttons
        const tracksList = document.getElementById('album-tracks-list');
        if (tracksList) {
            tracksList.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="play"]');
                if (!btn) return;
                const idx = parseInt(btn.dataset.index, 10);
                if (!Number.isFinite(idx)) return;
                this._playFromIndex(idx);
            });
        }
    }

    _playAll() {
        this._playFromIndex(0);
    }

    _playFromIndex(index) {
        const songs = this.album?.songs || [];
        if (!songs[index]) return;

        if (!window.bravoApp?.audioPlayer) {
            Toast.show('Player not available', 'error');
            return;
        }

        // the auth wrinkle. We just pass the raw song object and the
        // passing — which bypassed the backend stream endpoint. Don't.
        const song = songs[index];
        const playlist = songs;
        window.bravoApp.audioPlayer.loadSong(song, playlist);
    }

    _getFullUrl(url) {
        if (!url) return window.getDefaultImage?.() || '/js/images/bravo.png';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${this.staticUrl}${url}`;
        }
        return url;
    }

    _formatDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AlbumView = AlbumView;
