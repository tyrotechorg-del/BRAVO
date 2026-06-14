/**
 * Audio Player Component. All streams route through /api/songs/:id/stream for gating + analytics.
 */

class AudioPlayer {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.audio = new Audio();
        this.currentSong = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isShuffled = false;
        this.isRepeating = false;
        this.shuffledPlaylist = [];
        this.originalPlaylist = [];

        // Audio plays at full track volume; the user controls loudness
        // via the OS/device volume buttons. We don't ship an in-app
        // volume slider anymore (was a source of confusion — users
        // wondered why both their OS volume and the app slider mattered).
        // this.volume is kept on the instance for legacy code (setVolume,
        // increaseVolume) but has no UI counterpart.
        this.volume = 1.0;
        this.audio.volume = this.volume;

        this.apiBase = window.API_BASE_URL;
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.songsAPI = new SongsAPI();

        // Track the current blob URL so we can revoke it when switching
        // songs. Without this, premium streams leak memory — each
        // createObjectURL holds a reference to the audio buffer until
        // revoked, and the GC won't reclaim it.
        this._currentBlobUrl = null;

        // Mobile audio unlock state. iOS Safari refuses to play audio
        // without a user gesture. We mark `_unlocked = true` once the
        // user has interacted with the player at least once.
        this._unlocked = false;

        // For tracking unique plays (don't double-count if the user
        // seeks back to the start). We send a play-tracking event the
        // first time playback gets past the 30-second mark, per
        // industry convention (Spotify, etc.).
        this._playTracked = false;

        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.setupAudioEvents();
    }

    // Helpers
    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    _getFullUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        if (url.startsWith('/static')) return `${this.staticUrl}${url}`;
        return url;
    }

    _getStreamUrl(songId) {
        return `${this.apiBase}/songs/${encodeURIComponent(songId)}/stream`;
    }

    _isPremiumUser() {
        if (!window.authService?.isAuthenticated?.()) return false;
        const user = window.authService.getUser();
        if (!user) return false;
        // Admins always have access; artists who own the song handled separately.
        if (user.role === 'admin') return true;
        // Cached premium flag — not 100% accurate but avoids a roundtrip
        // on every song. The backend is the source of truth — if this
        // is wrong, the stream will 403 and we'll surface the overlay.
        return user.hasPremiumSubscription === true;
    }

    _isSongOwner(song) {
        if (!window.authService?.isAuthenticated?.()) return false;
        const user = window.authService.getUser();
        if (!user || !song?.artist) return false;
        const artistUserId = song.artist.userId || song.artist._id;
        if (!artistUserId) return false;
        return String(artistUserId) === String(user._id);
    }

    /**
     * Whether the user is allowed to play this song. Free songs are
     * always ok. Premium songs require admin, song owner, or active
     * listener_premium subscription.
     */
    _canPlay(song) {
        if (!song) return false;
        if (!song.isPremium) return true;
        const user = window.authService?.getUser?.();
        if (user?.role === 'admin') return true;
        if (this._isSongOwner(song)) return true;
        return this._isPremiumUser();
    }

    _formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
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

    
    _resolveDownloadUrl(url) {
        if (!url) return url;
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            const base = window.APP_CONFIG?.STATIC_URL || '';
            return `${base}${url}`;
        }
        return url;
    }

    // Render
    render() {
        if (!this.container) return;

        const defaultImg = window.getDefaultImage?.() || '/js/images/bravo.png';
        this.container.innerHTML = `
            <div class="player-container" data-player-root>
                <div class="player-info">
                    <img class="player-cover" id="player-cover" src="${this._escapeHtml(defaultImg)}" alt="Cover art">
                    <div class="player-details">
                        <div class="player-title" id="player-title">Select a song</div>
                        <div class="player-artist" id="player-artist">Bravo Music</div>
                    </div>
                </div>

                <div class="player-controls">
                    <button class="player-btn" type="button" id="shuffle-btn" title="Shuffle" aria-label="Shuffle">
                        <i class="fas fa-random"></i>
                    </button>
                    <button class="player-btn" type="button" id="prev-btn" title="Previous" aria-label="Previous">
                        <i class="fas fa-backward"></i>
                    </button>
                    <button class="player-btn play-pause" type="button" id="play-pause-btn" title="Play/Pause" aria-label="Play">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="player-btn" type="button" id="next-btn" title="Next" aria-label="Next">
                        <i class="fas fa-forward"></i>
                    </button>
                    <button class="player-btn" type="button" id="repeat-btn" title="Repeat" aria-label="Repeat">
                        <i class="fas fa-redo-alt"></i>
                    </button>
                </div>

                <div class="player-progress">
                    <span class="current-time" id="current-time">0:00</span>
                    <div class="progress-bar" id="progress-bar" role="slider" tabindex="0"
                         aria-label="Playback position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                        <div class="progress-fill" id="progress-fill"></div>
                    </div>
                    <span class="duration" id="duration">0:00</span>
                </div>

                <div class="player-extra">
                    <button class="player-btn" type="button" id="like-player-btn" title="Like" aria-label="Like">
                        <i class="far fa-heart"></i>
                    </button>
                    <button class="player-btn" type="button" id="share-player-btn" title="Share" aria-label="Share">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="player-btn" type="button" id="download-player-btn" title="Download" aria-label="Download">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `;

        // Reflect persistent toggle states from constructor flags.
        const shuffleBtn = document.getElementById('shuffle-btn');
        const repeatBtn = document.getElementById('repeat-btn');
        if (shuffleBtn && this.isShuffled) shuffleBtn.style.color = '#6c63ff';
        if (repeatBtn && this.isRepeating) repeatBtn.style.color = '#6c63ff';
    }

    setupEventListeners() {
        const get = (id) => document.getElementById(id);

        get('play-pause-btn')?.addEventListener('click', () => this.togglePlay());
        get('prev-btn')?.addEventListener('click', () => this.playPrevious());
        get('next-btn')?.addEventListener('click', () => this.playNext());
        get('shuffle-btn')?.addEventListener('click', () => this.toggleShuffle());
        get('repeat-btn')?.addEventListener('click', () => this.toggleRepeat());
        get('download-player-btn')?.addEventListener('click', () => this.downloadCurrentSong());
        get('share-player-btn')?.addEventListener('click', () => this.shareCurrentSong());
        get('like-player-btn')?.addEventListener('click', () => this.toggleLikeCurrentSong());
        get('progress-bar')?.addEventListener('click', (e) => this.seek(e));
        // Volume listeners removed — volume is controlled via the OS/device.

        // First user gesture anywhere on the player unlocks autoplay.
        this.container?.addEventListener('click', () => {
            this._unlocked = true;
        }, { once: true });
    }

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => {
            this._updateProgress();
            this._maybeTrackPlay();
        });
        this.audio.addEventListener('loadedmetadata', () => this._updateDuration());
        this.audio.addEventListener('ended', () => this._handleSongEnd());
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this._updatePlayButton(true);
        });
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this._updatePlayButton(false);
        });
        this.audio.addEventListener('error', () => this._handleAudioError());
    }

    // Load + play
    /**
     * Load a song. Decides between three strategies:
     *   - Premium + not eligible: show subscribe overlay, don't load
     *   - Premium + eligible: blob-fetch with Authorization header
     *   - Non-premium: regular <audio src> with backend stream URL
     */
    async loadSong(song, playlist = null) {
        if (!song) return;

        // Check premium eligibility BEFORE attempting to play.
        if (song.isPremium && !this._canPlay(song)) {
            this._showPremiumOverlay(song);
            return;
        }

        // Revoke previous blob URL if any.
        if (this._currentBlobUrl) {
            try { URL.revokeObjectURL(this._currentBlobUrl); } catch {}
            this._currentBlobUrl = null;
        }

        this.currentSong = song;
        this._playTracked = false;

        if (playlist) {
            this.playlist = playlist;
            this.originalPlaylist = [...playlist];
            if (this.isShuffled) {
                this._enableShuffleMode();
            } else {
                this.shuffledPlaylist = [];
                this.currentIndex = this.playlist.findIndex(s => s._id === song._id);
                if (this.currentIndex === -1) this.currentIndex = 0;
            }
        }

        // Update visible metadata BEFORE we kick off the network request.
        this._updateNowPlayingUI(song);
        this._updateLikeButtonState();

        // Stream URL strategy
        const streamUrl = this._getStreamUrl(song._id);

        try {
            if (song.isPremium && this._canPlay(song)) {
                // Premium + eligible: blob fetch with auth, then assign.
                Toast.show('Loading premium content...', 'info');
                const token = window.authService?.getToken?.();
                const response = await fetch(streamUrl, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (!response.ok) {
                    if (response.status === 403) {
                        // The cached premium flag was wrong — backend says no.
                        this._showPremiumOverlay(song);
                        return;
                    }
                    throw new Error(`Stream failed: ${response.status}`);
                }
                const blob = await response.blob();
                this._currentBlobUrl = URL.createObjectURL(blob);
                this.audio.src = this._currentBlobUrl;
            } else {
                // Non-premium: direct stream URL. optionalAuth on backend
                // lets guests through; Range streaming works.
                this.audio.src = streamUrl;
            }

            this.audio.load();

            // Auto-play if the player has already been unlocked by a
            // previous user gesture. Without a prior gesture, iOS
            // Safari throws NotAllowedError. We don't show an error
            // toast for that case — instead the play button just
            // stays in the "play" state and the user can tap it.
            const playPromise = this.audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.catch((err) => {
                    if (err.name === 'NotAllowedError') {
                        // iOS autoplay block. Don't toast — just wait
                        // for the user to tap play.
                        console.info('Autoplay blocked — waiting for user gesture.');
                    } else {
                        console.error('Play failed:', err);
                        Toast.show('Cannot play this song right now.', 'error');
                    }
                });
            }

            this._addToRecentlyPlayed(song._id);
        } catch (err) {
            console.error('Load song error:', err);
            Toast.show('Could not load this song. Please try another.', 'error');
        }
    }

    play() {
        if (!this.audio.src) return;
        this.audio.play().catch((err) => {
            if (err.name !== 'NotAllowedError') {
                console.error('Play failed:', err);
                Toast.show('Cannot play this song right now.', 'error');
            }
        });
    }

    pause() {
        this.audio.pause();
    }

    togglePlay() {
        if (this.isPlaying) this.pause();
        else this.play();
    }

    seek(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        if (Number.isFinite(this.audio.duration)) {
            this.audio.currentTime = Math.max(0, Math.min(1, percent)) * this.audio.duration;
        }
    }

    // Volume — programmatic only (no UI; user controls via OS)
    setVolume(volume) {
        const v = Math.max(0, Math.min(1, Number(volume)));
        this.volume = v;
        this.audio.volume = v;
    }

    // Kept because app.js wires keyboard shortcuts to these (Ctrl+Up/Down).
    increaseVolume() { this.setVolume(this.volume + 0.1); }
    decreaseVolume() { this.setVolume(this.volume - 0.1); }

    toggleMute() {
        this.audio.muted = !this.audio.muted;
    }

    // _updateMuteIcon kept as a no-op so external callers don't crash.
    _updateMuteIcon() { /* volume UI removed; nothing to update */ }

    // Shuffle / repeat / queue
    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        const btn = document.getElementById('shuffle-btn');
        if (this.isShuffled) {
            this._enableShuffleMode();
            if (btn) btn.style.color = '#6c63ff';
            Toast.show('Shuffle ON', 'info');
        } else {
            this._disableShuffleMode();
            if (btn) btn.style.color = '';
            Toast.show('Shuffle OFF', 'info');
        }
    }

    _enableShuffleMode() {
        if (this.playlist.length === 0) return;
        if (this.originalPlaylist.length === 0) this.originalPlaylist = [...this.playlist];
        this.shuffledPlaylist = [...this.playlist];
        for (let i = this.shuffledPlaylist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledPlaylist[i], this.shuffledPlaylist[j]] =
                [this.shuffledPlaylist[j], this.shuffledPlaylist[i]];
        }
        if (this.currentSong) {
            this.currentIndex = this.shuffledPlaylist.findIndex(s => s._id === this.currentSong._id);
            if (this.currentIndex === -1) this.currentIndex = 0;
        }
    }

    _disableShuffleMode() {
        if (this.originalPlaylist.length === 0) return;
        this.playlist = [...this.originalPlaylist];
        this.shuffledPlaylist = [];
        if (this.currentSong) {
            this.currentIndex = this.playlist.findIndex(s => s._id === this.currentSong._id);
            if (this.currentIndex === -1) this.currentIndex = 0;
        }
    }

    toggleRepeat() {
        this.isRepeating = !this.isRepeating;
        const btn = document.getElementById('repeat-btn');
        if (btn) btn.style.color = this.isRepeating ? '#6c63ff' : '';
        Toast.show(this.isRepeating ? 'Repeat ONE' : 'Repeat OFF', 'info');
    }

    _getCurrentPlaylist() {
        return this.isShuffled && this.shuffledPlaylist.length > 0
            ? this.shuffledPlaylist
            : this.playlist;
    }

    _handleSongEnd() {
        if (this.isRepeating) {
            this.audio.currentTime = 0;
            this.play();
        } else {
            this.playNext();
        }
    }

    playNext() {
        const list = this._getCurrentPlaylist();
        if (list.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % list.length;
        const next = list[this.currentIndex];
        if (next) this.loadSong(next, this.playlist);
    }

    playPrevious() {
        const list = this._getCurrentPlaylist();
        if (list.length === 0) return;
        // If we're past 3 seconds into the song, "previous" restarts current.
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        this.currentIndex = (this.currentIndex - 1 + list.length) % list.length;
        const prev = list[this.currentIndex];
        if (prev) this.loadSong(prev, this.playlist);
    }

    // Like
    async toggleLikeCurrentSong() {
        if (!this.currentSong) {
            Toast.show('No song selected', 'warning');
            return;
        }

        const isLoggedIn = window.authService?.isAuthenticated?.();

        // For LOGGED-IN users, hit the API (which records the real like
        // in the DB). Mirror to localStorage for instant UI.
        // For ANONYMOUS users, localStorage only.
        const likedSongs = this._getLikedSongs();
        const wasLiked = likedSongs.includes(this.currentSong._id);

        // Optimistic UI update.
        if (wasLiked) {
            this._setLikedSongs(likedSongs.filter(id => id !== this.currentSong._id));
        } else {
            this._setLikedSongs([...likedSongs, this.currentSong._id]);
        }
        this._updateLikeButtonState();

        if (!isLoggedIn) {
            Toast.show(wasLiked ? 'Removed from liked' : 'Added to liked', wasLiked ? 'info' : 'success');
            return;
        }

        try {
            const result = wasLiked
                ? await this.songsAPI.unlike(this.currentSong._id)
                : await this.songsAPI.like(this.currentSong._id);

            if (!result.success) {
                // Revert UI on failure.
                this._setLikedSongs(wasLiked ? [...likedSongs] : likedSongs.filter(id => id !== this.currentSong._id));
                this._updateLikeButtonState();
                Toast.show(result.error || 'Failed to update like', 'error');
                return;
            }
            Toast.show(wasLiked ? 'Removed from liked' : 'Added to liked ❤️', wasLiked ? 'info' : 'success');
        } catch (err) {
            console.error('Like toggle error:', err);
        }
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

    _updateLikeButtonState() {
        const btn = document.getElementById('like-player-btn');
        if (!btn || !this.currentSong) return;
        const liked = this._getLikedSongs().includes(this.currentSong._id);
        btn.innerHTML = liked
            ? '<i class="fas fa-heart" style="color: #ff4757;"></i>'
            : '<i class="far fa-heart"></i>';
        btn.title = liked ? 'Unlike' : 'Like';
    }

    // Download
    async downloadCurrentSong() {
        if (!this.currentSong) {
            Toast.show('No song selected', 'warning');
            return;
        }

        Toast.show(`Preparing "${this.currentSong.title}"...`, 'info');

        try {
            // Hit the backend download endpoint (NOT the static URL).
            // This applies rate-limiting (50/hr users, 20/hr guests),
            // records in the Download collection, and checks premium.
            const downloadUrl = `${this.apiBase}/downloads/song/${encodeURIComponent(this.currentSong._id)}`;
            const token = window.authService?.getToken?.();

            const response = await fetch(downloadUrl, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 403) {
                    Toast.show(data.error || 'This is a premium song. Subscribe to download.', 'warning');
                    return;
                }
                if (response.status === 429) {
                    Toast.show('Download limit reached. Try again later.', 'warning');
                    return;
                }
                throw new Error(data.error || `Download failed (${response.status})`);
            }

            const data = await response.json();

            // Backend returns either a direct URL or a signed S3 URL.
            // Either way we kick off the actual file download from that.
            const fileUrl = data.url || data.downloadUrl;
            if (!fileUrl) {
                throw new Error('No download URL in response');
            }

            await this._performFileDownload(fileUrl, this.currentSong);

            // Visual feedback
            const btn = document.getElementById('download-player-btn');
            if (btn) {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i>';
                btn.style.color = '#4caf50';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.style.color = '';
                }, 2000);
            }

            Toast.show(`Downloaded "${this.currentSong.title}" 📥`, 'success');
        } catch (err) {
            console.error('Download failed:', err);
            Toast.show('Download failed. Please try again.', 'error');
        }
    }

    async _performFileDownload(fileUrl, song) {
        // The backend may return either a full URL (signed S3 in production)
        // or a relative path like /uploads/audio/xxx.m4a (local dev).
        // Relative paths must be resolved against APP_CONFIG.STATIC_URL
        // (the backend host), NOT the frontend origin.
        const resolvedUrl = this._resolveDownloadUrl(fileUrl);

        // Fetch the actual audio file as a blob and trigger save dialog.
        const response = await fetch(resolvedUrl);
        if (!response.ok) throw new Error('File fetch failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        // Use the file extension from the source URL (not hardcoded .mp3).
        const ext = this._extOf(song.audioUrl || fileUrl);
        const safeTitle = String(song.title || 'song').replace(/[^a-z0-9_\-]+/gi, '_').toLowerCase();

        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeTitle}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // Share
    shareCurrentSong() {
        if (!this.currentSong) {
            Toast.show('No song selected', 'warning');
            return;
        }
        const songUrl = `${window.location.origin}/#song/${this.currentSong._id}`;
        const shareText = `Check out "${this.currentSong.title}" by ${this.currentSong.artist?.stageName || 'an artist'} on Bravo Music! 🎵`;

        if (navigator.share) {
            navigator.share({
                title: this.currentSong.title,
                text: shareText,
                url: songUrl
            }).catch(() => {});
            // Best-effort: tell the backend about the share so it counts.
            this.songsAPI.share(this.currentSong._id, 'native').catch(() => {});
            return;
        }

        if (window.ShareModal) {
            ShareModal.show(this.currentSong);
        } else {
            navigator.clipboard.writeText(songUrl).then(() => {
                Toast.show('Link copied to clipboard', 'success');
            }).catch(() => {
                Toast.show('Share: ' + songUrl, 'info');
            });
        }
        this.songsAPI.share(this.currentSong._id, 'copy').catch(() => {});
    }

    // Premium overlay (when user can't play premium content)
    _showPremiumOverlay(song) {
        if (!window.Modal) {
            Toast.show('This is premium content. Please subscribe.', 'warning');
            return;
        }

        const isLoggedIn = window.authService?.isAuthenticated?.();
        const safeTitle = this._escapeHtml(song.title);
        const priceTxt = song.price ? `K${Number(song.price).toFixed(2)}` : 'premium subscription';

        const content = `
            <div style="text-align: center; padding: 8px 0;">
                <i class="fas fa-crown" style="font-size: 48px; color: #ffc107; margin-bottom: 12px;"></i>
                <p style="margin: 12px 0;">
                    <strong>${safeTitle}</strong> is premium content.
                </p>
                <p style="color: #888; font-size: 14px;">
                    ${isLoggedIn
                        ? `Subscribe to Bravo Music Premium (K25/month) to unlock all premium songs, or buy this song for ${priceTxt}.`
                        : `Sign in and subscribe to play this song.`}
                </p>
            </div>
        `;

        const buttons = isLoggedIn
            ? [
                { text: 'Subscribe to Premium', class: 'btn-primary', action: 'subscribe',
                  onClick: () => window.bravoApp?.navigateTo?.('subscriptions') },
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' }
              ]
            : [
                { text: 'Sign In', class: 'btn-primary', action: 'login',
                  onClick: () => window.bravoApp?.navigateTo?.('login') },
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' }
              ];

        Modal.show({ title: 'Premium Content', content, buttons });
    }

    // UI updates
    _updateNowPlayingUI(song) {
        const titleEl = document.getElementById('player-title');
        const artistEl = document.getElementById('player-artist');
        const coverEl = document.getElementById('player-cover');

        // textContent — safe by default. Was using `.textContent` in the
        // original AudioPlayer (good) but I'm being explicit here.
        if (titleEl) titleEl.textContent = song.title || 'Unknown Title';
        if (artistEl) artistEl.textContent = song.artist?.stageName || 'Unknown Artist';

        if (coverEl) {
            const cover = song.coverArt
                ? this._getFullUrl(song.coverArt)
                : (window.getDefaultImage?.() || '/js/images/bravo.png');
            coverEl.src = cover;
            coverEl.alt = song.title || 'Cover art';
        }
    }

    _updateProgress() {
        const fill = document.getElementById('progress-fill');
        const timeEl = document.getElementById('current-time');
        const bar = document.getElementById('progress-bar');

        if (Number.isFinite(this.audio.duration)) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            if (fill) fill.style.width = `${percent}%`;
            if (bar) bar.setAttribute('aria-valuenow', String(Math.round(percent)));
        }
        if (timeEl) timeEl.textContent = this._formatTime(this.audio.currentTime);
    }

    _updateDuration() {
        const el = document.getElementById('duration');
        if (el) el.textContent = this._formatTime(this.audio.duration);
    }

    _updatePlayButton(isPlaying) {
        const btn = document.getElementById('play-pause-btn');
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }

    // Play tracking
    
    _maybeTrackPlay() {
        if (this._playTracked || !this.currentSong) return;
        if (this.audio.currentTime >= 30) {
            this._playTracked = true;
            // Backend already tracked via stream request; this hook
            // is here for future "qualified play" telemetry.
        }
    }

    // Recently played
    /**
     * Stores recently-played as IDs, not full song objects. The
     * original kept full song docs with cover URLs etc., bloating
     * localStorage and risking quota. IDs are sufficient — the
     * recent-plays page can fetch fresh metadata for display.
     */
    _addToRecentlyPlayed(songId) {
        let recent = [];
        try {
            recent = JSON.parse(localStorage.getItem('bravo_history') || '[]');
            if (!Array.isArray(recent)) recent = [];
        } catch {
            recent = [];
        }

        // De-dupe and prepend.
        recent = recent.filter((item) => {
            // Tolerate both old format (objects) and new format (strings).
            const id = typeof item === 'string' ? item : item?._id;
            return id !== songId;
        });
        recent.unshift(songId);
        recent = recent.slice(0, 50);

        localStorage.setItem('bravo_history', JSON.stringify(recent));
    }

    // Audio error handling
    _handleAudioError() {
        const err = this.audio.error;
        if (!err) return;
        let msg = 'Cannot play this song.';
        switch (err.code) {
            case 2: msg = 'Network error. Please check your connection.'; break;
            case 3: msg = 'Audio decoding error. File may be corrupted.'; break;
            case 4: msg = 'Audio format not supported by your browser.'; break;
        }
        Toast.show(msg, 'error');
    }
}

window.AudioPlayer = AudioPlayer;
