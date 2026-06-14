

class AlbumsPage {
    constructor() {
        this.albums = [];
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
    }

    async render() {
        return `
            <div class="albums-container">
                <div class="albums-header">
                    <h1>Albums</h1>
                    <p>Explore trending albums on Bravo Music</p>
                </div>

                <div class="albums-grid" id="albums-grid" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div><p>Loading albums...</p></div>
                </div>

                <div id="artist-cta" style="display:none; text-align:center; margin-top: 32px; padding: 24px; background: rgba(108,99,255,0.05); border-radius: 12px;">
                    <p style="margin-bottom: 12px;">Manage your own albums in the artist dashboard.</p>
                    <button class="btn-primary" type="button" data-nav="dashboard">Go to Dashboard</button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        // Show artist CTA if the user is an artist or admin
        if (window.authService?.isArtist?.() || window.authService?.isAdmin?.()) {
            const cta = document.getElementById('artist-cta');
            if (cta) {
                cta.style.display = 'block';
                cta.querySelector('[data-nav]')?.addEventListener('click', () => {
                    if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('dashboard');
                    else window.location.hash = 'dashboard';
                });
            }
        }

        await this._loadAlbums();
    }

    async _loadAlbums() {
        const grid = document.getElementById('albums-grid');
        if (!grid) return;

        try {
            const albumsAPI = new AlbumsAPI();
            const albums = await albumsAPI.getTrending();
            this.albums = Array.isArray(albums) ? albums : [];

            grid.innerHTML = '';

            if (this.albums.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-compact-disc"></i>
                        <h3>No trending albums yet</h3>
                        <p>Check back as new music drops.</p>
                    </div>
                `;
                return;
            }

            this.albums.forEach(album => {
                grid.appendChild(this._buildAlbumCard(album));
            });
        } catch (err) {
            console.error('Load albums error:', err);
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load albums. Please try again.</p>
                </div>
            `;
        }
    }

    _buildAlbumCard(album) {
        const safeTitle = this._escapeHtml(album.title || 'Untitled');
        const safeArtist = this._escapeHtml(album.artist?.stageName || 'Unknown Artist');
        const trackCount = Array.isArray(album.songs) ? album.songs.length : 0;
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';

        const card = document.createElement('div');
        card.className = 'album-card';
        card.setAttribute('data-album-id', album._id);
        card.innerHTML = `
            <img class="album-cover" alt="${safeTitle}">
            <div class="album-overlay">
                <button class="play-album-btn" type="button" data-action="play" title="Play album" aria-label="Play album">
                    <i class="fas fa-play"></i>
                </button>
                <button class="view-album-btn" type="button" data-action="view" title="View album" aria-label="View album">
                    <i class="fas fa-info-circle"></i>
                </button>
            </div>
            <div class="album-info">
                <h4>${safeTitle}</h4>
                <p>${safeArtist}</p>
                <span>${trackCount} track${trackCount === 1 ? '' : 's'}</span>
            </div>
        `;

        const img = card.querySelector('.album-cover');
        if (img) {
            img.src = this._getFullUrl(album.coverArt);
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }

        // Delegated click — card click navigates; button clicks act.
        card.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                e.stopPropagation();
                if (actionEl.dataset.action === 'play') {
                    this._playAlbum(album);
                } else if (actionEl.dataset.action === 'view') {
                    this._viewAlbum(album._id);
                }
                return;
            }
            this._viewAlbum(album._id);
        });

        return card;
    }

    _playAlbum(album) {
        const songs = album.songs || [];
        if (songs.length === 0) {
            Toast.show('This album has no songs yet', 'info');
            return;
        }
        if (!window.bravoApp?.audioPlayer) {
            Toast.show('Player not available', 'error');
            return;
        }
        window.bravoApp.audioPlayer.loadSong(songs[0], songs);
    }

    _viewAlbum(albumId) {
        if (window.bravoApp?.navigateTo) {
            window.bravoApp.navigateTo(`album/${albumId}`);
        } else {
            window.location.hash = `album/${albumId}`;
        }
    }

    _getFullUrl(url) {
        if (!url) return window.getDefaultImage?.() || '/js/images/bravo.png';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${this.staticUrl}${url}`;
        }
        return url;
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AlbumsPage = AlbumsPage;
