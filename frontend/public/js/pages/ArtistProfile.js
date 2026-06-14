/**
 * Artist Profile Page
 */

class ArtistProfile {
    constructor(artistId) {
        this.artistId = artistId;
        this.artist = null;
        this.songs = [];
        this.isFollowing = false;
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
    }

    async render() {
        await this._loadArtist();

        if (!this.artist) {
            return `
                <div class="artist-profile-container">
                    <div class="empty-state" style="text-align: center; padding: 60px 20px;">
                        <i class="fas fa-user-slash" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                        <h2>Artist not found</h2>
                        <p style="color: #888; margin-bottom: 24px;">
                            This artist may not exist or their profile is unavailable.
                        </p>
                        <button class="btn-primary" type="button" data-nav="browse">Browse Music</button>
                    </div>
                </div>
            `;
        }

        const a = this.artist;
        const safeName = this._escapeHtml(a.stageName || 'Unknown Artist');
        const safeBio = a.bio ? this._escapeHtml(a.bio) : null;
        const monthly = this._formatNumber(a.monthlyListeners || 0);
        const followerCount = this._formatNumber(a.followerCount || 0);
        const isVerified = a.verified === true;
        const isLoggedIn = window.authService?.isAuthenticated?.();
        const userIsThisArtist = this._userIsThisArtist();

        return `
            <div class="artist-profile-container">
                <div class="artist-header">
                    <div class="artist-cover-wrap">
                        <img class="artist-cover" alt="${safeName}" id="artist-cover">
                    </div>
                    <div class="artist-info">
                        <h1>${safeName}</h1>
                        ${isVerified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified Artist</span>' : ''}
                        <div class="artist-stats">
                            <span><i class="fas fa-headphones"></i> ${monthly} monthly listeners</span>
                            <span><i class="fas fa-users"></i> ${followerCount} followers</span>
                            <span><i class="fas fa-music"></i> <span id="song-count">0</span> songs</span>
                        </div>
                        ${!userIsThisArtist && isLoggedIn ? `
                            <button id="follow-btn" class="btn-primary" type="button" style="margin-top: 12px;">
                                <i class="fas fa-${this.isFollowing ? 'check' : 'plus'}"></i>
                                ${this.isFollowing ? 'Following' : 'Follow'}
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="artist-content">
                    ${safeBio ? `
                        <div class="artist-bio">
                            <h2>About</h2>
                            <p>${safeBio}</p>
                        </div>
                    ` : ''}

                    <div class="artist-music">
                        <h2>Songs</h2>
                        <div class="songs-grid" id="artist-songs-grid" aria-live="polite">
                            <div class="loading-container"><div class="spinner"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async _loadArtist() {
        try {
            const artistsAPI = new ArtistsAPI();
            const result = await artistsAPI.getById(this.artistId);
            this.artist = result?.data || result || null;
            // Follow state from server, if logged in
            const user = window.authService?.getUser?.();
            if (user && Array.isArray(user.following) && this.artist) {
                const artistUserId = this.artist.userId || this.artist._id;
                this.isFollowing = user.following.some(id => String(id) === String(artistUserId));
            }
        } catch (err) {
            console.error('Load artist error:', err);
            this.artist = null;
        }
    }

    _userIsThisArtist() {
        if (!this.artist) return false;
        const user = window.authService?.getUser?.();
        if (!user) return false;
        const artistUserId = this.artist.userId || this.artist._id;
        return String(user._id) === String(artistUserId);
    }

    async afterRender() {
        if (!this.artist) {
            // Wire the "Browse Music" button on the not-found screen.
            document.querySelector('[data-nav="browse"]')?.addEventListener('click', () => {
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('browse');
                else window.location.hash = 'browse';
            });
            return;
        }

        // Cover image with fallback
        const cover = document.getElementById('artist-cover');
        if (cover) {
            cover.src = this._getFullUrl(this.artist.coverArt || this.artist.avatar);
            cover.addEventListener('error', () => {
                cover.src = window.getDefaultImage?.() || '/js/images/bravo.png';
            }, { once: true });
        }

        // Follow button wiring
        const followBtn = document.getElementById('follow-btn');
        if (followBtn) {
            followBtn.addEventListener('click', () => this._toggleFollow(followBtn));
        }

        await this._loadSongs();
    }

    async _loadSongs() {
        const grid = document.getElementById('artist-songs-grid');
        if (!grid) return;

        try {
            const songsAPI = new SongsAPI();
            // NOTE: the endpoint expects the Artist's _id (not the User._id).
            const songs = await songsAPI.getByArtist(this.artist._id);
            this.songs = Array.isArray(songs) ? songs : [];

            // Update the song count in the header
            const countEl = document.getElementById('song-count');
            if (countEl) countEl.textContent = String(this.songs.length);

            grid.innerHTML = '';

            if (this.songs.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-music"></i>
                        <p>No songs yet from this artist.</p>
                    </div>
                `;
                return;
            }

            // Canonical SongCard for every song.
            this.songs.forEach(song => {
                new SongCard(song, grid, { playlist: this.songs });
            });
        } catch (err) {
            console.error('Load artist songs error:', err);
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load songs.</p>
                </div>
            `;
        }
    }

    async _toggleFollow(btn) {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show('Please login to follow artists', 'info');
            return;
        }
        if (this._userIsThisArtist()) {
            Toast.show("You can't follow yourself", 'info');
            return;
        }

        const wasFollowing = this.isFollowing;
        // Optimistic UI
        this.isFollowing = !wasFollowing;
        this._renderFollowButton(btn);

        try {
            const path = wasFollowing
                ? `/users/${encodeURIComponent(this.artist.userId || this.artist._id)}/unfollow`
                : `/users/${encodeURIComponent(this.artist.userId || this.artist._id)}/follow`;
            const { ok, data } = await window.authService.api._request(path, { method: 'POST' });

            if (!ok) {
                // Revert
                this.isFollowing = wasFollowing;
                this._renderFollowButton(btn);
                Toast.show(data?.error || 'Failed to update follow status', 'error');
                return;
            }

            Toast.show(wasFollowing ? 'Unfollowed' : `Following ${this.artist.stageName}`, 'success');
        } catch (err) {
            console.error('Follow toggle error:', err);
            this.isFollowing = wasFollowing;
            this._renderFollowButton(btn);
        }
    }

    _renderFollowButton(btn) {
        btn.innerHTML = `<i class="fas fa-${this.isFollowing ? 'check' : 'plus'}"></i> ${this.isFollowing ? 'Following' : 'Follow'}`;
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

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.ArtistProfile = ArtistProfile;
