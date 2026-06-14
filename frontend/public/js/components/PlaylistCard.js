

class PlaylistCard {
    constructor(playlist, container, options = {}) {
        this.playlist = playlist;
        this.container = container;
        // Back-compat: accept the old onPlay/onDelete positional args too.
        if (typeof options === 'function') {
            this.onPlay = options;
            this.onDelete = arguments[3] || null;
            this.options = {};
        } else {
            this.options = options || {};
            this.onPlay = options.onPlay || null;
            this.onDelete = options.onDelete || null;
        }
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.playlistsAPI = new PlaylistsAPI();
        this.render();
    }

    _isOwner() {
        const user = window.authService?.getUser?.();
        if (!user) return false;
        // Playlist.owner could be a populated User or just an ID.
        const ownerId = this.playlist.owner?._id || this.playlist.owner || this.playlist.user;
        return String(ownerId) === String(user._id);
    }

    _coverUrl() {
        const url = this.playlist.coverArt
            || this.playlist.songs?.[0]?.coverArt
            || null;
        if (!url) return window.getDefaultImage?.() || '/js/images/bravo.png';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${this.staticUrl}${url}`;
        }
        return url;
    }

    render() {
        const safeName = this._escapeHtml(this.playlist.name || 'Untitled');
        const safeDescription = this.playlist.description
            ? this._escapeHtml(this.playlist.description) : '';
        const songCount = this.playlist.songs?.length || 0;
        const isOwner = this._isOwner();
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';

        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.setAttribute('data-playlist-id', this.playlist._id);
        card.innerHTML = `
            <div class="playlist-cover">
                <img class="playlist-cover-img" alt="${safeName}">
                <div class="playlist-overlay">
                    <button class="play-playlist-btn" type="button" data-action="play" title="Play all" aria-label="Play all">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <span class="playlist-song-count">${songCount} song${songCount === 1 ? '' : 's'}</span>
            </div>
            <div class="playlist-info">
                <h4 class="playlist-name">${safeName}</h4>
                <p class="playlist-details">${this.playlist.isPublic ? 'Public' : 'Private'}</p>
                ${safeDescription ? `<p class="playlist-description">${safeDescription}</p>` : ''}
            </div>
            ${isOwner ? `
                <div class="playlist-actions">
                    <button class="btn-icon" type="button" data-action="edit" title="Edit" aria-label="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" type="button" data-action="delete" title="Delete" aria-label="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon" type="button" data-action="share" title="Share" aria-label="Share">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            ` : `
                <div class="playlist-actions">
                    <button class="btn-icon" type="button" data-action="share" title="Share" aria-label="Share">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            `}
        `;

        const img = card.querySelector('.playlist-cover-img');
        if (img) {
            img.src = this._coverUrl();
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }

        // Delegated handler
        card.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                e.stopPropagation();
                this._handleAction(actionEl.dataset.action);
                return;
            }
            // Card click → playlist detail page
            if (window.bravoApp?.navigateTo) {
                window.bravoApp.navigateTo(`playlist/${this.playlist._id}`);
            } else {
                window.location.hash = `playlist/${this.playlist._id}`;
            }
        });

        this.container.appendChild(card);
    }

    _handleAction(action) {
        switch (action) {
            case 'play': return this._playAll();
            case 'edit': return this._showEditModal();
            case 'delete': return this._confirmDelete();
            case 'share': return this._share();
        }
    }

    _playAll() {
        const songs = this.playlist.songs || [];
        if (songs.length === 0) {
            Toast.show('This playlist is empty', 'info');
            return;
        }
        if (typeof this.onPlay === 'function') {
            this.onPlay(songs[0], songs);
            return;
        }
        if (window.bravoApp?.audioPlayer) {
            window.bravoApp.audioPlayer.loadSong(songs[0], songs);
        }
    }

    _showEditModal() {
        if (!this._isOwner()) {
            Toast.show("You can only edit your own playlists", 'info');
            return;
        }

        // Build the modal with a form, then populate values via DOM
        // (avoids attribute-interpolation escaping issues).
        const handle = Modal.show({
            title: 'Edit Playlist',
            content: `
                <form id="edit-playlist-form">
                    <div class="form-group">
                        <label for="edit-pl-name">Playlist Name</label>
                        <input type="text" id="edit-pl-name" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="edit-pl-desc">Description</label>
                        <textarea id="edit-pl-desc" rows="3" maxlength="500"></textarea>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="edit-pl-public">
                            Make Public
                        </label>
                    </div>
                    <div id="edit-pl-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save', class: 'btn-primary', action: 'save' }
            ]
        });

        // Populate AFTER modal mounts. Setting via .value / .checked
        // doesn't go through HTML parsing, so no attribute injection.
        requestAnimationFrame(() => {
            const nameInput = document.getElementById('edit-pl-name');
            const descInput = document.getElementById('edit-pl-desc');
            const publicInput = document.getElementById('edit-pl-public');
            if (nameInput) nameInput.value = this.playlist.name || '';
            if (descInput) descInput.value = this.playlist.description || '';
            if (publicInput) publicInput.checked = Boolean(this.playlist.isPublic);

            // Override the Modal's default Save behaviour to actually
            const saveBtn = handle?.element?.querySelector('[data-action="save"]');
            if (saveBtn) {
                saveBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this._saveEdit(handle);
                });
            }
        });
    }

    async _saveEdit(modalHandle) {
        const name = document.getElementById('edit-pl-name')?.value.trim() || '';
        const description = document.getElementById('edit-pl-desc')?.value.trim() || '';
        const isPublic = document.getElementById('edit-pl-public')?.checked || false;
        const errorEl = document.getElementById('edit-pl-error');

        if (!name) {
            if (errorEl) errorEl.textContent = 'Name is required';
            return;
        }
        if (name.length > 100) {
            if (errorEl) errorEl.textContent = 'Name must be 100 characters or fewer';
            return;
        }

        try {
            const result = await this.playlistsAPI.update(this.playlist._id, {
                name, description, isPublic
            });
            if (!result.success) {
                if (errorEl) errorEl.textContent = result.error || 'Failed to save';
                return;
            }

            // Update local state + UI
            Object.assign(this.playlist, { name, description, isPublic });
            Toast.show('Playlist updated', 'success');
            modalHandle?.close?.();

            // Refresh the card's visible name in place
            const card = this.container.querySelector(`[data-playlist-id="${this.playlist._id}"]`);
            if (card) {
                const nameEl = card.querySelector('.playlist-name');
                const detailsEl = card.querySelector('.playlist-details');
                if (nameEl) nameEl.textContent = name;
                if (detailsEl) detailsEl.textContent = isPublic ? 'Public' : 'Private';
            }
        } catch (err) {
            console.error('Edit playlist error:', err);
            if (errorEl) errorEl.textContent = 'Network error';
        }
    }

    _confirmDelete() {
        if (!this._isOwner()) return;
        Modal.confirm(`Delete "${this.playlist.name}"? This cannot be undone.`, async () => {
            try {
                const result = typeof this.onDelete === 'function'
                    ? await this.onDelete(this.playlist._id)
                    : await this.playlistsAPI.delete(this.playlist._id);

                if (result && result.success === false) {
                    Toast.show(result.error || 'Failed to delete', 'error');
                    return;
                }

                // Remove the card from the DOM
                const card = this.container.querySelector(`[data-playlist-id="${this.playlist._id}"]`);
                if (card) this.container.removeChild(card);
                Toast.show('Playlist deleted', 'success');
            } catch (err) {
                console.error('Delete playlist error:', err);
                Toast.show('Failed to delete', 'error');
            }
        });
    }

    _share() {
        const url = `${window.location.origin}/#playlist/${this.playlist._id}`;
        const shareText = `Check out "${this.playlist.name}" on Bravo Music`;

        if (navigator.share) {
            navigator.share({ title: this.playlist.name, text: shareText, url })
                .catch(() => {});
            return;
        }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url)
                .then(() => Toast.show('Link copied to clipboard', 'success'))
                .catch(() => Toast.show(url, 'info'));
        } else {
            Toast.show(url, 'info');
        }
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.PlaylistCard = PlaylistCard;
