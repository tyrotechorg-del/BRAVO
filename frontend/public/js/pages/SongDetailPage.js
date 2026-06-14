

class SongDetailPage {
    constructor(songId) {
        this.songId = songId;
        this.song = null;
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.apiUrl = window.API_BASE_URL;
        this.isLiking = false; // prevent double-click race
    }

    async render() {
        await this._loadSong();

        if (!this.song) {
            return `
                <div class="error-state" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-music-slash" style="font-size: 48px; color: #888; margin-bottom: 16px;"></i>
                    <h2>Song not found</h2>
                    <p style="color: #888;">This song may have been removed or is no longer available.</p>
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('browse')" style="margin-top: 16px;">
                        Browse Music
                    </button>
                </div>
            `;
        }

        const s = this.song;
        const coverUrl = this._getFullUrl(s.coverArt) || (window.getDefaultImage?.() || '');
        const isLiked = this._getLikedSongs().includes(s._id);

        const canPlay = this._canPlay(s);
        const isPremium = s.isPremium === true;
        const price = Number(s.price) || 0;

        // Genre badge class — sanitized lower-case (only letters/digits/underscore).
        const genre = String(s.genre || '');
        const genreClass = genre.toLowerCase().replace(/[^a-z0-9_]/g, '');

        return `
            <div class="song-detail-container">
                ${isPremium ? `
                    <div class="premium-banner" style="background: linear-gradient(135deg, #ffc107, #ff9800); color: #000; padding: 8px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-crown"></i>
                        <span><strong>Premium Track</strong> ${price > 0 ? `&middot; K${price.toFixed(2)}` : ''}</span>
                    </div>
                ` : ''}

                <div class="song-detail-header">
                    <img src="${this._escapeAttr(coverUrl)}"
                         alt="Cover of ${this._escapeAttr(s.title)}"
                         class="song-detail-cover">
                    <div class="song-detail-info">
                        <h1>${this._escapeHtml(s.title)}</h1>
                        <p class="song-detail-artist">
                            <i class="fas fa-user"></i>
                            ${this._escapeHtml(s.artist?.stageName || 'Unknown Artist')}
                        </p>
                        <div class="song-detail-stats">
                            <span><i class="fas fa-tag"></i> ${this._escapeHtml(s.genre || 'Various')}</span>
                            <span><i class="fas fa-play"></i> ${this._formatNumber(s.playCount || 0)} plays</span>
                            <span><i class="fas fa-heart"></i> ${this._formatNumber(s.likeCount || 0)} likes</span>
                            <span><i class="fas fa-download"></i> ${this._formatNumber(s.downloadCount || 0)} downloads</span>
                            <span><i class="fas fa-share"></i> ${this._formatNumber(s.shareCount || 0)} shares</span>
                        </div>
                        <div class="song-detail-actions">
                            ${canPlay
                                ? `<button class="btn-primary" id="play-song-btn"><i class="fas fa-play"></i> Play Now</button>`
                                : `<button class="btn-primary" id="play-song-btn" style="background: #ffc107; color: #000;">
                                       <i class="fas fa-crown"></i> Subscribe to Play
                                   </button>`
                            }
                            <button class="btn-outline ${isLiked ? 'liked' : ''}" id="like-song-btn">
                                <i class="fas fa-heart"></i> ${isLiked ? 'Liked' : 'Like'}
                            </button>
                            <button class="btn-outline" id="download-song-btn">
                                <i class="fas fa-download"></i> Download
                            </button>
                            <button class="btn-outline" id="share-song-btn">
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                        </div>
                    </div>
                </div>

                ${(genre === 'Cuundu' || genre === 'Kalindula') ? `
                    <div class="genre-badge-large ${this._escapeAttr(genreClass)}">
                        <i class="fas fa-music"></i>
                        ${this._escapeHtml(genre)} Music &mdash; Traditional Zambian Sound
                    </div>
                ` : ''}

                ${s.lyrics ? `
                    <div class="song-lyrics" id="song-lyrics">
                        <h3>Lyrics</h3>
                        <div class="lyrics-content">${this._escapeHtml(s.lyrics).replace(/\n/g, '<br>')}</div>
                    </div>
                ` : ''}

                <div class="song-comments">
                    <h3>Comments</h3>
                    <div id="comment-section-container"></div>
                </div>
            </div>
        `;
    }

    async _loadSong() {
        try {
            const songsAPI = new SongsAPI();
            this.song = await songsAPI.getById(this.songId);
        } catch (err) {
            console.error('Load song error:', err);
            this.song = null;
        }
    }

    async afterRender() {
        // Play button
        const playBtn = document.getElementById('play-song-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this._handlePlay());
        }

        // Like button
        const likeBtn = document.getElementById('like-song-btn');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => this._handleLike(likeBtn));
        }

        // Download button
        const downloadBtn = document.getElementById('download-song-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this._handleDownload(downloadBtn));
        }

        // Share button
        const shareBtn = document.getElementById('share-song-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this._handleShare());
        }

        // Mount the comment section component if available.
        const commentContainer = document.getElementById('comment-section-container');
        if (commentContainer && window.CommentSection) {
            new CommentSection(this.songId, '#comment-section-container');
        }
    }

    // Event handlers
    _handlePlay() {
        if (!this.song) return;
        const player = window.bravoApp?.audioPlayer;
        if (!player) {
            Toast.show('Player not ready', 'error');
            return;
        }
        // Hand the song to AudioPlayer — it handles premium gating
        // and stream-URL construction.
        player.loadSong(this.song);
    }

    async _handleLike(likeBtn) {
        if (this.isLiking) return;
        if (!this.song) return;

        this.isLiking = true;

        const liked = this._getLikedSongs().includes(this.song._id);
        const wasLiked = liked;

        // Optimistic update
        if (wasLiked) {
            this._setLikedSongs(this._getLikedSongs().filter(id => id !== this.song._id));
            likeBtn.innerHTML = '<i class="fas fa-heart"></i> Like';
            likeBtn.classList.remove('liked');
        } else {
            this._setLikedSongs([...this._getLikedSongs(), this.song._id]);
            likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
            likeBtn.classList.add('liked');
        }

        const isLoggedIn = window.authService?.isAuthenticated?.();
        if (!isLoggedIn) {
            // Guests: localStorage only, no API call.
            Toast.show(wasLiked ? 'Removed from liked' : 'Added to liked ❤️', wasLiked ? 'info' : 'success');
            this.isLiking = false;
            return;
        }

        try {
            const songsAPI = new SongsAPI();
            const result = wasLiked
                ? await songsAPI.unlike(this.song._id)
                : await songsAPI.like(this.song._id);

            if (!result.success) {
                // Revert UI
                if (wasLiked) {
                    this._setLikedSongs([...this._getLikedSongs(), this.song._id]);
                    likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
                    likeBtn.classList.add('liked');
                } else {
                    this._setLikedSongs(this._getLikedSongs().filter(id => id !== this.song._id));
                    likeBtn.innerHTML = '<i class="fas fa-heart"></i> Like';
                    likeBtn.classList.remove('liked');
                }
                Toast.show(result.error || 'Failed to update like', 'error');
            } else {
                Toast.show(wasLiked ? 'Removed from liked' : 'Added to liked ❤️', wasLiked ? 'info' : 'success');
            }
        } catch (err) {
            console.error('Like toggle error:', err);
        } finally {
            this.isLiking = false;
        }
    }

    async _handleDownload(downloadBtn) {
        if (!this.song) return;

        // Same backend-routed download as AudioPlayer.downloadCurrentSong
        // — rate limited, analytics tracked, premium-gated.
        downloadBtn.disabled = true;
        const originalHtml = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';

        try {
            const downloadUrl = `${this.apiUrl}/downloads/song/${encodeURIComponent(this.song._id)}`;
            const token = window.authService?.getToken?.();
            const response = await fetch(downloadUrl, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 403) {
                    Toast.show(data.error || 'Premium song — subscribe to download.', 'warning');
                } else if (response.status === 429) {
                    Toast.show('Download limit reached. Try again later.', 'warning');
                } else {
                    Toast.show(data.error || 'Download failed', 'error');
                }
                return;
            }

            const data = await response.json();
            const fileUrl = data.url || data.downloadUrl;
            if (!fileUrl) throw new Error('No download URL in response');

            await this._performFileDownload(fileUrl);
            Toast.show(`Downloaded "${this.song.title}" 📥`, 'success');
        } catch (err) {
            console.error('Download failed:', err);
            Toast.show('Download failed. Please try again.', 'error');
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalHtml;
        }
    }

    async _performFileDownload(fileUrl) {
        // Resolve relative paths against the backend STATIC_URL (not the
        // frontend origin). Same logic as AudioPlayer._resolveDownloadUrl.
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

        // Extension from the audio URL — not hardcoded .mp3.
        const ext = this._extOf(this.song.audioUrl || fileUrl);
        const safeTitle = String(this.song.title || 'song').replace(/[^a-z0-9_\-]+/gi, '_').toLowerCase();

        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    _handleShare() {
        if (!this.song) return;
        if (window.ShareModal) {
            ShareModal.show(this.song);
            return;
        }
        const songUrl = `${window.location.origin}/#song/${this.song._id}`;
        if (navigator.share) {
            navigator.share({ title: this.song.title, url: songUrl }).catch(() => {});
        } else {
            navigator.clipboard?.writeText(songUrl).then(() => Toast.show('Link copied', 'success'));
        }
        // Track share (best-effort).
        new SongsAPI().share(this.song._id, navigator.share ? 'native' : 'copy').catch(() => {});
    }

    // Helpers
    _canPlay(song) {
        if (!song || !song.isPremium) return true;
        const user = window.authService?.getUser?.();
        if (!user) return false;
        if (user.role === 'admin') return true;
        const artistUserId = song.artist?.userId || song.artist?._id;
        if (artistUserId && String(artistUserId) === String(user._id)) return true;
        return user.hasPremiumSubscription === true;
    }

    _getLikedSongs() {
        try {
            return JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        } catch {
            return [];
        }
    }

    _setLikedSongs(ids) {
        localStorage.setItem('bravo_liked_songs', JSON.stringify(ids));
    }

    _getFullUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    _extOf(url) {
        const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url || '');
        return m ? m[1].toLowerCase() : 'mp3';
    }

    _formatNumber(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
        return String(num || 0);
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    _escapeAttr(text) { return this._escapeHtml(text); }
}

window.SongDetailPage = SongDetailPage;
