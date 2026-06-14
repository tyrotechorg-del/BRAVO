

class SongCard {
    constructor(song, container, options = {}) {
        this.song = song;
        this.container = container;
        this.rank = options.rank || null;
        this.playlist = options.playlist || null;
        this.hideDownload = options.hideDownload === true;
        this.onPlay = options.onPlay || ((song) => {
            if (window.bravoApp?.audioPlayer) {
                window.bravoApp.audioPlayer.loadSong(song, this.playlist);
            }
        });
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.songsAPI = new SongsAPI();
        this.render();
    }

    // Helpers
    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    _getFullUrl(url) {
        if (!url) return window.getDefaultImage?.() || '/js/images/bravo.png';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${this.staticUrl}${url}`;
        }
        return url;
    }

    _formatNumber(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
        return String(num || 0);
    }

    _extOf(url) {
        const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url || '');
        return m ? m[1].toLowerCase() : 'mp3';
    }

    _getLikedSongs() {
        try {
            return JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        } catch {
            return [];
        }
    }

    _isDownloaded() {
        try {
            const downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
            return downloads.some(d => d._id === this.song._id);
        } catch {
            return false;
        }
    }

    // Render
    render() {
        const liked = this._getLikedSongs().includes(this.song._id);
        const downloaded = this._isDownloaded();
        const coverUrl = this._getFullUrl(this.song.coverArt);
        const isPremium = this.song.isPremium === true;
        const fallbackImg = window.getDefaultImage?.() || '/js/images/bravo.png';

        const card = document.createElement('div');
        card.className = 'song-card' + (this.rank ? ' trending-card' : '');
        card.setAttribute('data-song-id', this.song._id);

        // Build with createElement so we never interpolate untrusted
        // values into innerHTML. The inner overlay HTML uses static
        // strings and pre-escaped values.
        const safeTitle = this._escapeHtml(this.song.title);
        const safeArtist = this._escapeHtml(this.song.artist?.stageName || 'Unknown Artist');
        const safeGenre = this._escapeHtml(this.song.genre || '');

        const rankBadge = this.rank
            ? `<div class="trending-rank">#${this.rank}</div>`
            : '';

        const premiumBadge = isPremium
            ? `<div class="premium-badge" title="Premium content"><i class="fas fa-crown"></i></div>`
            : '';

        const downloadButton = this.hideDownload ? '' : `
            <button class="download-btn ${downloaded ? 'downloaded' : ''}"
                    type="button" data-action="download"
                    title="${downloaded ? 'Downloaded' : 'Download'}"
                    aria-label="Download">
                <i class="fas fa-download"></i>
            </button>`;

        const downloadedBadge = downloaded
            ? '<span class="downloaded-badge"><i class="fas fa-check"></i> Downloaded</span>'
            : '';

        card.innerHTML = `
            ${rankBadge}
            ${premiumBadge}
            <img class="song-card-cover" alt="${safeTitle}">
            <div class="song-card-overlay">
                <button class="play-btn" type="button" data-action="play" title="Play" aria-label="Play">
                    <i class="fas fa-play"></i>
                </button>
                <button class="like-btn ${liked ? 'liked' : ''}" type="button" data-action="like"
                        title="${liked ? 'Unlike' : 'Like'}" aria-label="${liked ? 'Unlike' : 'Like'}">
                    <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                </button>
                ${downloadButton}
                <button class="share-btn" type="button" data-action="share"
                        title="Share" aria-label="Share">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
            <div class="song-card-info">
                <h4 class="song-title">${safeTitle}</h4>
                <p class="song-artist">${safeArtist}</p>
                <div class="song-stats">
                    <span><i class="fas fa-play"></i> ${this._formatNumber(this.song.playCount || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${this._formatNumber(this.song.likeCount || 0)}</span>
                    ${safeGenre ? `<span><i class="fas fa-tag"></i> ${safeGenre}</span>` : ''}
                    ${downloadedBadge}
                </div>
            </div>
        `;

        // Set the cover image src via JS so we can attach an onerror
        // handler without inline interpolation.
        const img = card.querySelector('.song-card-cover');
        if (img) {
            img.src = coverUrl;
            img.addEventListener('error', () => { img.src = fallbackImg; }, { once: true });
        }

        // Delegated click handler — one listener for the whole card.
        card.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                e.stopPropagation();
                this._handleAction(actionEl.dataset.action, card);
                return;
            }
            // Card click without an action button → navigate to detail.
            if (window.bravoApp?.navigateTo) {
                window.bravoApp.navigateTo(`song/${this.song._id}`);
            } else {
                window.location.hash = `song/${this.song._id}`;
            }
        });

        this.container.appendChild(card);
    }

    // Actions
    _handleAction(action, card) {
        switch (action) {
            case 'play': return this._handlePlay();
            case 'like': return this._handleLike(card);
            case 'download': return this._handleDownload(card);
            case 'share': return this._handleShare();
        }
    }

    _handlePlay() {
        // The song object goes straight to AudioPlayer which (from
        // + tap-to-play handling. We don't need to mutate the song
        // object here — pass it through.
        const songForPlayer = {
            ...this.song,
            // The cover URL is what AudioPlayer displays directly.
            // Still need to resolve to a full URL since AudioPlayer
            // doesn't know about staticUrl.
            coverArt: this._getFullUrl(this.song.coverArt)
        };
        this.onPlay(songForPlayer);
    }

    async _handleLike(card) {
        const likeBtn = card.querySelector('.like-btn');
        if (!likeBtn) return;

        const isLoggedIn = window.authService?.isAuthenticated?.();
        const likedSongs = this._getLikedSongs();
        const wasLiked = likedSongs.includes(this.song._id);

        // Optimistic UI
        if (wasLiked) {
            this._setLikedSongs(likedSongs.filter(id => id !== this.song._id));
            this._setLikeButtonState(likeBtn, false);
        } else {
            this._setLikedSongs([...likedSongs, this.song._id]);
            this._setLikeButtonState(likeBtn, true);
        }

        if (!isLoggedIn) {
            Toast.show(wasLiked ? 'Removed from liked' : 'Added to liked', wasLiked ? 'info' : 'success');
            return;
        }

        try {
            const result = wasLiked
                ? await this.songsAPI.unlike(this.song._id)
                : await this.songsAPI.like(this.song._id);

            if (!result.success) {
                // Revert
                if (wasLiked) {
                    this._setLikedSongs([...likedSongs]);
                    this._setLikeButtonState(likeBtn, true);
                } else {
                    this._setLikedSongs(likedSongs.filter(id => id !== this.song._id));
                    this._setLikeButtonState(likeBtn, false);
                }
                Toast.show(result.error || 'Failed to update like', 'error');
                return;
            }

            Toast.show(wasLiked ? 'Removed from liked' : 'Added to liked ❤️', wasLiked ? 'info' : 'success');
        } catch (err) {
            console.error('Like toggle error:', err);
        }
    }

    _setLikedSongs(ids) {
        localStorage.setItem('bravo_liked_songs', JSON.stringify(ids));
    }

    _setLikeButtonState(btn, liked) {
        btn.classList.toggle('liked', liked);
        const icon = btn.querySelector('i');
        if (icon) icon.className = `${liked ? 'fas' : 'far'} fa-heart`;
        btn.title = liked ? 'Unlike' : 'Like';
        btn.setAttribute('aria-label', liked ? 'Unlike' : 'Like');
    }

    async _handleDownload(card) {
        const downloadBtn = card.querySelector('.download-btn');
        if (!downloadBtn) return;

        Toast.show(`Preparing "${this.song.title}"...`, 'info');

        try {
            // Hit the backend download endpoint (NOT the static URL).
            // rate limiting, premium checks, and Download collection
            // records.
            const apiBase = window.API_BASE_URL;
            const downloadUrl = `${apiBase}/downloads/song/${encodeURIComponent(this.song._id)}`;
            const token = window.authService?.getToken?.();

            const response = await fetch(downloadUrl, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 403) {
                    Toast.show(data.error || 'Premium content — subscribe to download.', 'warning');
                    return;
                }
                if (response.status === 429) {
                    Toast.show('Download limit reached. Try again later.', 'warning');
                    return;
                }
                throw new Error(data.error || `Download failed (${response.status})`);
            }

            const data = await response.json();
            const fileUrl = data.url || data.downloadUrl;
            if (!fileUrl) throw new Error('No download URL in response');

            await this._performFileDownload(fileUrl);

            // Save locally for the "Downloaded" badge
            this._saveLocalDownload();
            downloadBtn.classList.add('downloaded');
            downloadBtn.title = 'Downloaded';

            // Add the "Downloaded" badge to stats if not already there
            const stats = card.querySelector('.song-stats');
            if (stats && !stats.querySelector('.downloaded-badge')) {
                const badge = document.createElement('span');
                badge.className = 'downloaded-badge';
                badge.innerHTML = '<i class="fas fa-check"></i> Downloaded';
                stats.appendChild(badge);
            }

            Toast.show(`Downloaded "${this.song.title}" 📥`, 'success');
        } catch (err) {
            console.error('Download failed:', err);
            Toast.show('Download failed. Please try again.', 'error');
        }
    }

    async _performFileDownload(fileUrl) {
        // Backend may return a full URL (signed S3 in production) or a
        // relative path (/uploads/... in local dev). Relative paths must
        // be resolved against APP_CONFIG.STATIC_URL (backend host), NOT
        // the frontend origin which fetch() would otherwise use.
        const resolvedUrl = (() => {
            if (!fileUrl) return fileUrl;
            if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
            if (fileUrl.startsWith('/uploads') || fileUrl.startsWith('/static')) {
                return `${window.APP_CONFIG?.STATIC_URL || ''}${fileUrl}`;
            }
            return fileUrl;
        })();

        const response = await fetch(resolvedUrl);
        if (!response.ok) throw new Error('File fetch failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        // Use real extension, not hardcoded .mp3
        const ext = this._extOf(this.song.audioUrl || fileUrl);
        const safeName = String(this.song.title || 'song')
            .replace(/[^a-z0-9_\-]+/gi, '_')
            .toLowerCase();

        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    _saveLocalDownload() {
        let downloads = [];
        try {
            downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
            if (!Array.isArray(downloads)) downloads = [];
        } catch {
            downloads = [];
        }

        if (!downloads.some(d => d._id === this.song._id)) {
            // Store only the IDs + minimal metadata. The full song
            // can be re-fetched via songsAPI.getById when needed.
            downloads.unshift({
                _id: this.song._id,
                title: this.song.title,
                coverArt: this.song.coverArt,
                downloadedAt: new Date().toISOString()
            });
            downloads = downloads.slice(0, 100);
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(downloads));
        }
    }

    _handleShare() {
        if (window.ShareModal) {
            ShareModal.show(this.song);
        } else if (navigator.share) {
            const songUrl = `${window.location.origin}/#song/${this.song._id}`;
            navigator.share({
                title: this.song.title,
                text: `Check out "${this.song.title}" on Bravo Music`,
                url: songUrl
            }).catch(() => {});
            this.songsAPI.share(this.song._id, 'native').catch(() => {});
        } else {
            const songUrl = `${window.location.origin}/#song/${this.song._id}`;
            navigator.clipboard.writeText(songUrl)
                .then(() => Toast.show('Link copied to clipboard', 'success'))
                .catch(() => Toast.show('Share: ' + songUrl, 'info'));
            this.songsAPI.share(this.song._id, 'copy').catch(() => {});
        }
    }
}

window.SongCard = SongCard;
