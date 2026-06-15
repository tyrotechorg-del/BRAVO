

class ArtistAlbumsPage {
    constructor() {
        this.albums = [];
        this.albumsAPI = new AlbumsAPI();
        this.artistsAPI = new ArtistsAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.loading = true;
    }

    async render() {
        return `
            <div class="albums-container">
                <div class="albums-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1>My Albums</h1>
                        <p style="color:#888;">Manage albums and singles you've released on Bravo Music.</p>
                    </div>
                    <button class="btn-primary" type="button" id="create-album-btn">
                        <i class="fas fa-plus"></i> Create Album
                    </button>
                </div>

                <div class="albums-grid" id="my-albums-grid" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in', 'warning');
            return;
        }

        document.getElementById('create-album-btn')?.addEventListener('click', () => this._showCreateModal());

        await this._loadAlbums();
        this._renderAlbums();
    }

    async _loadAlbums() {
        try {
            const result = await this.albumsAPI.getMyAlbums();
            // Tolerate either wrapper { success, data } or raw array.
            const data = result?.success ? result.data : result;
            this.albums = Array.isArray(data) ? data : (data?.albums || []);
        } catch (err) {
            console.error('Load my albums error:', err);
            this.albums = [];
        }
        this.loading = false;
    }

    _renderAlbums() {
        const grid = document.getElementById('my-albums-grid');
        if (!grid) return;

        if (this.albums.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-compact-disc"></i>
                    <h3>No albums yet</h3>
                    <p>Create your first album or EP.</p>
                    <button class="btn-primary" type="button" id="first-album-btn">Create Album</button>
                </div>
            `;
            document.getElementById('first-album-btn')?.addEventListener('click', () => this._showCreateModal());
            return;
        }

        grid.innerHTML = '';
        this.albums.forEach(album => grid.appendChild(this._buildAlbumCard(album)));
    }

    _buildAlbumCard(album) {
        const safeTitle = this._escapeHtml(album.title || 'Untitled');
        const trackCount = Array.isArray(album.songs) ? album.songs.length : 0;
        const safeStatus = this._escapeHtml(album.status || 'draft');
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';

        const card = document.createElement('div');
        card.className = 'album-card editable';
        card.setAttribute('data-album-id', album._id);
        card.innerHTML = `
            <img class="album-cover" alt="${safeTitle}">
            <div class="album-overlay">
                <button class="btn-icon" type="button" data-action="edit" title="Edit album" aria-label="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" type="button" data-action="tracks" title="Manage tracks" aria-label="Manage tracks">
                    <i class="fas fa-music"></i>
                </button>
                <button class="btn-icon" type="button" data-action="view" title="View album" aria-label="View">
                    <i class="fas fa-info-circle"></i>
                </button>
                <button class="btn-icon" type="button" data-action="delete" title="Delete album" aria-label="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="album-info">
                <h4>${safeTitle}</h4>
                <p>${trackCount} track${trackCount === 1 ? '' : 's'}</p>
                <span class="album-status badge badge-${album.status === 'published' ? 'success' : 'warning'}">${safeStatus}</span>
            </div>
        `;

        const img = card.querySelector('.album-cover');
        if (img) {
            img.src = this._getFullUrl(album.coverArt);
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }

        card.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) return;
            e.stopPropagation();
            const action = actionEl.dataset.action;
            if (action === 'edit') this._showEditModal(album);
            else if (action === 'tracks') this._showManageTracksModal(album);
            else if (action === 'view') this._showDetailModal(album);
            else if (action === 'delete') this._confirmDelete(album, card);
        });

        return card;
    }

    // Create modal
    _showCreateModal() {
        const genres = this._genres();
        const handle = Modal.show({
            title: 'Create New Album',
            content: `
                <form id="create-album-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="ca-title">Album Title *</label>
                        <input type="text" id="ca-title" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label for="ca-cover">Cover Art * (max 5MB)</label>
                        <input type="file" id="ca-cover" accept="image/*" required>
                    </div>
                    <div class="form-group">
                        <label for="ca-description">Description</label>
                        <textarea id="ca-description" rows="3" maxlength="1000"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="ca-genre">Genre</label>
                        <select id="ca-genre">
                            <option value="">Select Genre</option>
                            ${genres.map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="ca-type">Type</label>
                        <select id="ca-type">
                            <option value="album">Album</option>
                            <option value="ep">EP</option>
                            <option value="single">Single</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="ca-price">Price (Kwacha)</label>
                        <input type="number" id="ca-price" value="0" min="0" step="0.01">
                    </div>
                    <div id="ca-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Create Album', class: 'btn-primary', action: 'create' }
            ]
        });

        requestAnimationFrame(() => {
            const createBtn = handle?.element?.querySelector('[data-action="create"]');
            if (!createBtn) return;
            createBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._submitCreate(handle);
            });
        });
    }

    async _submitCreate(handle) {
        const errorEl = document.getElementById('ca-error');
        errorEl.textContent = '';

        const title = document.getElementById('ca-title').value.trim();
        const coverFile = document.getElementById('ca-cover').files[0];
        const description = document.getElementById('ca-description').value.trim();
        const genre = document.getElementById('ca-genre').value;
        const type = document.getElementById('ca-type').value;
        const price = parseFloat(document.getElementById('ca-price').value || '0');

        if (!title) {
            errorEl.textContent = 'Title is required';
            return;
        }
        if (!coverFile) {
            errorEl.textContent = 'Cover art is required';
            return;
        }
        if (coverFile.size > 5 * 1024 * 1024) {
            errorEl.textContent = 'Cover image must be 5MB or less';
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('coverArt', coverFile);
        if (description) formData.append('description', description);
        if (genre) formData.append('genre', genre);
        if (type) formData.append('type', type);
        if (Number.isFinite(price)) formData.append('price', String(price));

        const submitBtn = handle?.element?.querySelector('[data-action="create"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
        }

        const result = await this.albumsAPI.create(formData);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Album';
        }

        if (!result.success) {
            errorEl.textContent = result.error || 'Failed to create album';
            return;
        }

        handle?.close?.();
        Toast.show?.('Album created', 'success');

        // Append the new album in place.
        const created = result.data?.album || result.data;
        if (created) {
            this.albums.unshift(created);
            this._renderAlbums();
        } else {
            await this._loadAlbums();
            this._renderAlbums();
        }
    }

    // Edit modal
    async _showEditModal(albumStub) {
        // Fetch the full album so all fields are accurate.
        const result = await this.albumsAPI.getById(albumStub._id);
        const album = result?.success ? result.data : (result || albumStub);
        if (!album) {
            Toast.show?.('Could not load album', 'error');
            return;
        }

        const genres = this._genres();
        const safeTitle = this._escapeHtml(album.title || '');
        const handle = Modal.show({
            title: `Edit Album: ${safeTitle}`,
            content: `
                <form id="ea-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label for="ea-title">Album Title</label>
                        <input type="text" id="ea-title" required maxlength="100">
                    </div>
                    <div class="form-group">
                        <label>Current Cover</label>
                        <div><img id="ea-current-cover" style="width:80px; height:80px; object-fit:cover; border-radius:4px;"></div>
                        <label for="ea-cover" style="margin-top:8px;">New Cover (optional, max 5MB)</label>
                        <input type="file" id="ea-cover" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label for="ea-description">Description</label>
                        <textarea id="ea-description" rows="3" maxlength="1000"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="ea-genre">Genre</label>
                        <select id="ea-genre">
                            <option value="">Select Genre</option>
                            ${genres.map(g => `<option value="${this._escapeAttr(g)}">${this._escapeHtml(g)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="ea-price">Price (Kwacha)</label>
                        <input type="number" id="ea-price" min="0" step="0.01">
                    </div>
                    <div class="form-group">
                        <label for="ea-status">Status</label>
                        <select id="ea-status">
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                        </select>
                    </div>
                    <div id="ea-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save Changes', class: 'btn-primary', action: 'save' }
            ]
        });

        requestAnimationFrame(() => {
            // Populate via JS — no attribute interpolation with album data.
            const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
            set('ea-title', album.title);
            set('ea-description', album.description);
            set('ea-genre', album.genre);
            set('ea-price', album.price);
            set('ea-status', album.status || 'draft');

            const coverImg = document.getElementById('ea-current-cover');
            if (coverImg) {
                coverImg.src = this._getFullUrl(album.coverArt);
                coverImg.addEventListener('error', () => {
                    coverImg.src = window.getDefaultImage?.() || '/js/images/bravo.png';
                }, { once: true });
            }

            const saveBtn = handle?.element?.querySelector('[data-action="save"]');
            if (saveBtn) {
                saveBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this._submitEdit(album._id, handle);
                });
            }
        });
    }

    async _submitEdit(albumId, handle) {
        const errorEl = document.getElementById('ea-error');
        errorEl.textContent = '';

        const title = document.getElementById('ea-title').value.trim();
        const description = document.getElementById('ea-description').value.trim();
        const genre = document.getElementById('ea-genre').value;
        const priceRaw = document.getElementById('ea-price').value;
        const price = priceRaw === '' ? null : parseFloat(priceRaw);
        const status = document.getElementById('ea-status').value;
        const coverFile = document.getElementById('ea-cover').files[0];

        if (!title) {
            errorEl.textContent = 'Title is required';
            return;
        }
        if (coverFile && coverFile.size > 5 * 1024 * 1024) {
            errorEl.textContent = 'Cover image must be 5MB or less';
            return;
        }

        const saveBtn = handle?.element?.querySelector('[data-action="save"]');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        let result;
        if (coverFile) {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            if (genre) formData.append('genre', genre);
            if (price != null) formData.append('price', String(price));
            formData.append('status', status);
            formData.append('coverArt', coverFile);
            result = await this.albumsAPI.updateWithCover(albumId, formData);
        } else {
            result = await this.albumsAPI.update(albumId, {
                title,
                description,
                genre,
                price: price != null ? price : undefined,
                status
            });
        }

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }

        if (!result.success) {
            errorEl.textContent = result.error || 'Failed to update album';
            return;
        }

        handle?.close?.();
        Toast.show?.('Album updated', 'success');

        // Update card in place
        const updated = result.data?.album || result.data;
        if (updated) {
            const idx = this.albums.findIndex(a => a._id === albumId);
            if (idx >= 0) {
                this.albums[idx] = { ...this.albums[idx], ...updated };
                this._renderAlbums();
            }
        }
    }

    // Manage Tracks modal — add/remove songs from an album
    async _showManageTracksModal(albumStub) {
        // Fetch the full album (with populated songs) + the artist's
        // own songs (so we know what's available to add).
        // albumsAPI.getById returns the raw data (or null) — not a
        // {success, data} wrapper. Same for artistsAPI.getMySongs.
        const [albumData, mySongsData] = await Promise.all([
            this.albumsAPI.getById(albumStub._id),
            this.artistsAPI.getMySongs()
        ]);

        // Backend returns { album: {...} } or just the album doc directly
        const album = albumData?.album || albumData || albumStub;
        if (!album || !album._id) {
            Toast.show?.('Could not load album', 'error');
            return;
        }

        // mySongs may be { songs: [...] } or a plain array
        const mySongs = Array.isArray(mySongsData)
            ? mySongsData
            : (mySongsData?.songs || mySongsData?.data?.songs || []);

        // IDs currently in this album. The album.songs field may be an
        // array of ObjectId strings OR populated Song objects depending
        // on the controller — handle both.
        const songsInAlbum = Array.isArray(album.songs) ? album.songs : [];
        const inAlbumIds = new Set(songsInAlbum.map(s => String(s._id || s)));

        const safeTitle = this._escapeHtml(album.title || 'Untitled');

        const handle = Modal.show({
            title: `Manage Tracks — ${safeTitle}`,
            content: `
                <div class="manage-tracks-modal" style="max-height:60vh; overflow-y:auto;">
                    <div style="margin-bottom:16px;">
                        <h4 style="margin:0 0 8px;">In this album (<span id="mt-in-count">${songsInAlbum.length}</span>)</h4>
                        <div id="mt-in-list" style="background:#0f0f1e; border-radius:8px; padding:8px; min-height:40px;">
                            ${songsInAlbum.length === 0 ? '<p style="color:#888; text-align:center; padding:12px;">No tracks yet — add from your songs below.</p>' : ''}
                        </div>
                    </div>

                    <div>
                        <h4 style="margin:0 0 8px;">Your songs</h4>
                        <input type="search" id="mt-search" placeholder="Filter by title..."
                               style="width:100%; padding:8px; background:#1a1a2e; border:1px solid #2a2a3e; border-radius:6px; color:#fff; margin-bottom:8px;">
                        <div id="mt-available-list" style="background:#0f0f1e; border-radius:8px; padding:8px; min-height:40px;"></div>
                    </div>

                    <div id="mt-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </div>
            `,
            buttons: [
                { text: 'Done', class: 'btn-primary', action: 'close' }
            ]
        });

        // Pending operations to prevent double-clicks
        const pending = new Set();

        const renderRow = (song, isInAlbum) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #1f1f33;';
            const safeSongTitle = this._escapeHtml(song.title || 'Untitled');
            const duration = song.duration ? this._formatDuration(song.duration) : '';
            row.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <div style="color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeSongTitle}</div>
                    ${duration ? `<div style="color:#888; font-size:12px;">${duration}</div>` : ''}
                </div>
                <button type="button" class="mt-action btn-icon" title="${isInAlbum ? 'Remove from album' : 'Add to album'}"
                    style="background:${isInAlbum ? '#ff4757' : '#2ecc71'}; color:white; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer;">
                    <i class="fas fa-${isInAlbum ? 'times' : 'plus'}"></i>
                </button>
            `;

            const btn = row.querySelector('.mt-action');
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (pending.has(song._id)) return;
                pending.add(song._id);
                btn.disabled = true;

                const result = isInAlbum
                    ? await this.albumsAPI.removeSong(album._id, song._id)
                    : await this.albumsAPI.addSong(album._id, song._id);

                pending.delete(song._id);
                btn.disabled = false;

                if (!result.success) {
                    const errEl = document.getElementById('mt-error');
                    if (errEl) errEl.textContent = result.error || (isInAlbum ? 'Failed to remove' : 'Failed to add');
                    else Toast.show?.(result.error || 'Failed', 'error');
                    return;
                }

                Toast.show?.(isInAlbum ? 'Track removed' : 'Track added', 'success', 1500);

                // Update local state
                if (isInAlbum) {
                    inAlbumIds.delete(String(song._id));
                } else {
                    inAlbumIds.add(String(song._id));
                }
                rerender();

                // Also update the album card on the page (track count badge)
                const idx = this.albums.findIndex(a => a._id === album._id);
                if (idx >= 0) {
                    this.albums[idx].songs = Array.from(inAlbumIds);
                    this._renderAlbums();
                }
            });

            return row;
        };

        const rerender = () => {
            const inList = document.getElementById('mt-in-list');
            const avList = document.getElementById('mt-available-list');
            const inCount = document.getElementById('mt-in-count');
            const searchTerm = (document.getElementById('mt-search')?.value || '').toLowerCase();

            if (inList) {
                inList.innerHTML = '';
                const inSongs = mySongs.filter(s => inAlbumIds.has(String(s._id)));
                if (inSongs.length === 0) {
                    inList.innerHTML = '<p style="color:#888; text-align:center; padding:12px;">No tracks yet — add from your songs below.</p>';
                } else {
                    inSongs.forEach(s => inList.appendChild(renderRow(s, true)));
                }
                if (inCount) inCount.textContent = String(inSongs.length);
            }

            if (avList) {
                avList.innerHTML = '';
                const available = mySongs.filter(s =>
                    !inAlbumIds.has(String(s._id)) &&
                    (!searchTerm || (s.title || '').toLowerCase().includes(searchTerm))
                );
                if (available.length === 0) {
                    avList.innerHTML = `<p style="color:#888; text-align:center; padding:12px;">${
                        searchTerm
                            ? 'No songs match your search.'
                            : mySongs.length === 0
                                ? 'You haven\u2019t uploaded any songs yet. Upload songs first, then come back here.'
                                : 'All your songs are already in this album.'
                    }</p>`;
                } else {
                    available.forEach(s => avList.appendChild(renderRow(s, false)));
                }
            }
        };

        requestAnimationFrame(() => {
            const searchInput = document.getElementById('mt-search');
            searchInput?.addEventListener('input', rerender);
            rerender();
        });
    }

    _formatDuration(seconds) {
        const s = Number(seconds);
        if (!isFinite(s) || s <= 0) return '';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }

    // Detail modal
    _showDetailModal(album) {
        const safeTitle = this._escapeHtml(album.title || '');
        const safeArtist = this._escapeHtml(album.artist?.stageName || 'You');
        const safeGenre = this._escapeHtml(album.genre || 'Various');
        const safeType = this._escapeHtml(album.type || 'album');
        const safeDesc = album.description ? this._escapeHtml(album.description) : '';
        const releaseDate = album.releaseDate ? new Date(album.releaseDate).toLocaleDateString() : '—';
        const trackCount = Array.isArray(album.songs) ? album.songs.length : 0;
        const totalStreams = Number(album.totalStreams || 0);

        const trackHtml = (album.songs || []).map((song, idx) => `
            <div class="album-song-item" data-song-id="${this._escapeAttr(song._id)}">
                <div class="song-number">${idx + 1}</div>
                <div class="song-info">
                    <div class="song-title">${this._escapeHtml(song.title || 'Untitled')}</div>
                    <div class="song-duration">${this._formatDuration(song.duration)}</div>
                </div>
                <div class="song-actions">
                    <button class="btn-icon" type="button" data-action="play-song" data-index="${idx}" aria-label="Play track">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
        `).join('') || '<div class="empty-state">No songs in this album yet.</div>';

        const handle = Modal.show({
            title: safeTitle,
            content: `
                <div class="album-detail-view">
                    <img id="adv-cover" class="album-detail-cover" alt="${safeTitle}" style="width:120px; height:120px; object-fit:cover; border-radius:8px;">
                    <div class="album-detail-info" style="margin-top:12px;">
                        <p><strong>Artist:</strong> ${safeArtist}</p>
                        <p><strong>Genre:</strong> ${safeGenre}</p>
                        <p><strong>Type:</strong> ${safeType}</p>
                        <p><strong>Release Date:</strong> ${this._escapeHtml(releaseDate)}</p>
                        <p><strong>Total Tracks:</strong> ${trackCount}</p>
                        <p><strong>Total Streams:</strong> ${totalStreams}</p>
                        ${safeDesc ? `<p><strong>Description:</strong> ${safeDesc}</p>` : ''}
                    </div>
                </div>

                <div class="album-songs-section" style="margin-top:16px;">
                    <h3>Tracklist</h3>
                    <div class="album-songs-list" id="adv-tracks-list">${trackHtml}</div>
                </div>
            `,
            buttons: [
                { text: 'Close', class: 'btn-secondary', action: 'close' }
            ]
        });

        requestAnimationFrame(() => {
            const cover = document.getElementById('adv-cover');
            if (cover) {
                cover.src = this._getFullUrl(album.coverArt);
                cover.addEventListener('error', () => {
                    cover.src = window.getDefaultImage?.() || '/js/images/bravo.png';
                }, { once: true });
            }

            const tracksList = document.getElementById('adv-tracks-list');
            if (tracksList) {
                tracksList.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-action="play-song"]');
                    if (!btn) return;
                    const idx = parseInt(btn.dataset.index, 10);
                    const song = album.songs?.[idx];
                    if (song && window.bravoApp?.audioPlayer) {
                        window.bravoApp.audioPlayer.loadSong(song, album.songs);
                    }
                });
            }
        });
    }

    // Delete
    _confirmDelete(album, cardEl) {
        const doDelete = async () => {
            const result = await this.albumsAPI.delete(album._id);
            if (!result.success) {
                Toast.show?.(result.error || 'Failed to delete album', 'error');
                return;
            }
            this.albums = this.albums.filter(a => a._id !== album._id);
            if (cardEl?.parentNode) cardEl.parentNode.removeChild(cardEl);
            if (this.albums.length === 0) this._renderAlbums();
            Toast.show?.('Album deleted', 'success');
        };

        if (window.Modal?.confirm) {
            Modal.confirm(`Delete "${album.title}"? Songs in this album won't be deleted, just unlinked.`, doDelete);
        } else if (confirm(`Delete "${album.title}"?`)) {
            doDelete();
        }
    }

    // Helpers
    _genres() {
        return Array.isArray(window.GENRES) && window.GENRES.length > 0
            ? window.GENRES
            : ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel',
               'Traditional', 'Amapiano', 'Cuundu', 'Soul', 'Rock', 'Kalindula', 'Other'];
    }

    _formatDuration(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
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

    _escapeAttr(text) {
        return this._escapeHtml(text);
    }
}

window.ArtistAlbumsPage = ArtistAlbumsPage;
