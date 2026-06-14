/**
 * Admin Albums Page
 */

class AdminAlbumsPage {
    constructor() {
        this.allAlbums = [];      // unfiltered, as fetched
        this.albums = [];         // currently displayed (after filter)
        this.searchTerm = '';
        this.adminAPI = new AdminAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.processing = new Set();
    }

    async render() {
        return `
            <div class="admin-albums-page">
                <div class="page-header">
                    <h1><i class="fas fa-compact-disc"></i> Albums</h1>
                    <p>View and manage all albums on the platform.</p>
                </div>

                <div class="albums-stats" id="al-stats" style="display:flex; gap:12px; margin-bottom:16px;">
                    <div class="stat-card-sm"><div class="stat-value" id="al-stat-total">—</div><div class="stat-label">Total</div></div>
                    <div class="stat-card-sm published"><div class="stat-value" id="al-stat-published">—</div><div class="stat-label">Published</div></div>
                    <div class="stat-card-sm draft"><div class="stat-value" id="al-stat-draft">—</div><div class="stat-label">Draft</div></div>
                </div>

                <div class="filters-bar" style="display:flex; gap:8px; margin-bottom:16px;">
                    <input type="text" id="al-search" placeholder="Search title or artist..." style="flex:1; min-width:200px;">
                    <button class="btn-secondary" type="button" id="al-search-btn"><i class="fas fa-search"></i> Search</button>
                    <button class="btn-outline" type="button" id="al-refresh-btn"><i class="fas fa-sync-alt"></i> Refresh</button>
                </div>

                <div class="albums-table-container" id="al-container" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAdmin?.()) {
            Toast.show?.('Admin access required', 'error');
            return;
        }
        const searchInput = document.getElementById('al-search');
        if (searchInput) searchInput.value = this.searchTerm;

        const applySearch = () => {
            this.searchTerm = (searchInput?.value || '').trim().toLowerCase();
            this._applyFilter();
            this._renderTable();
            this._renderStats();
        };
        document.getElementById('al-search-btn')?.addEventListener('click', applySearch);
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applySearch();
        });
        document.getElementById('al-refresh-btn')?.addEventListener('click', async () => {
            this.searchTerm = '';
            if (searchInput) searchInput.value = '';
            await this._loadAndRender();
            Toast.show?.('Refreshed', 'success');
        });

        await this._loadAndRender();
    }

    async _loadAndRender() {
        const result = await this.adminAPI.getAllAlbums();
        if (result.success) {
            const data = result.data;
            this.allAlbums = Array.isArray(data) ? data : (data?.albums || []);
        } else {
            this.allAlbums = [];
        }
        this._applyFilter();
        this._renderStats();
        this._renderTable();
    }

    _applyFilter() {
        if (!this.searchTerm) {
            this.albums = this.allAlbums.slice();
            return;
        }
        const term = this.searchTerm;
        this.albums = this.allAlbums.filter(a =>
            (a.title || '').toLowerCase().includes(term) ||
            (a.artist?.stageName || '').toLowerCase().includes(term)
        );
    }

    _renderStats() {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
        set('al-stat-total', this.allAlbums.length);
        set('al-stat-published', this.allAlbums.filter(a => a.status === 'published').length);
        set('al-stat-draft', this.allAlbums.filter(a => a.status === 'draft').length);
    }

    _renderTable() {
        const container = document.getElementById('al-container');
        if (!container) return;

        if (this.albums.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-compact-disc"></i>
                    <h3>No albums found</h3>
                    ${this.searchTerm ? '<p>Try a different search term.</p>' : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="al-table">
                <thead>
                    <tr>
                        <th>Cover</th>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Genre</th>
                        <th>Type</th>
                        <th>Tracks</th>
                        <th>Status</th>
                        <th>Released</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="al-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('al-tbody');
        this.albums.forEach(a => tbody.appendChild(this._buildRow(a)));

        document.getElementById('al-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-album-id]');
            if (!row) return;
            const album = this.albums.find(a => String(a._id) === String(row.dataset.albumId));
            if (!album) return;
            const action = btn.dataset.action;
            if (action === 'view') this._viewAlbum(album);
            else if (action === 'tracks') this._showManageTracksModal(album);
            else if (action === 'delete') this._deleteAlbum(album, row);
        });
    }

    _buildRow(a) {
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const safeTitle = this._escapeHtml(a.title || 'Untitled');
        const safeArtist = this._escapeHtml(a.artist?.stageName || 'Unknown');
        const safeGenre = this._escapeHtml(a.genre || 'Various');
        const safeType = this._escapeHtml(a.type || 'album');
        const safeStatus = this._escapeHtml(a.status || 'draft');
        const trackCount = Array.isArray(a.songs) ? a.songs.length : 0;
        const released = a.releaseDate ? new Date(a.releaseDate).toLocaleDateString() : '—';

        const tr = document.createElement('tr');
        tr.setAttribute('data-album-id', a._id);
        tr.innerHTML = `
            <td><img class="album-cover-sm" alt="${safeTitle}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;"></td>
            <td><strong>${safeTitle}</strong></td>
            <td>${safeArtist}</td>
            <td><span class="genre-badge">${safeGenre}</span></td>
            <td><span class="type-badge type-${safeType}">${safeType}</span></td>
            <td>${trackCount}</td>
            <td><span class="status-badge status-${safeStatus}">${safeStatus}</span></td>
            <td>${this._escapeHtml(released)}</td>
            <td class="actions-cell">
                <button class="btn-icon" type="button" data-action="view" aria-label="View album">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon" type="button" data-action="tracks" aria-label="Manage tracks" title="Manage tracks">
                    <i class="fas fa-music"></i>
                </button>
                <button class="btn-danger btn-sm" type="button" data-action="delete" aria-label="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        const img = tr.querySelector('.album-cover-sm');
        if (img) {
            const cover = this._safeImageUrl(a.coverArt);
            img.src = cover || fallback;
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }
        return tr;
    }

    _viewAlbum(album) {
        if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(`album/${album._id}`);
        else window.location.hash = `album/${album._id}`;
    }

    async _showManageTracksModal(albumStub) {
        // Admin: can add ANY song to ANY album. Fetch the full album
        // (populated songs) + all songs in the system.
        const albumsAPI = new AlbumsAPI();
        const [albumResult, allSongsResult] = await Promise.all([
            albumsAPI.getById(albumStub._id),
            this.adminAPI.getAllSongs(1, 500)   // capped at 500 — admin tools rarely need more
        ]);

        const album = albumResult?.success ? (albumResult.data?.album || albumResult.data) : null;
        if (!album) {
            Toast.show?.('Could not load album', 'error');
            return;
        }

        const allSongs = allSongsResult?.success
            ? (allSongsResult.data?.songs || allSongsResult.data || [])
            : Array.isArray(allSongsResult) ? allSongsResult : [];

        const songsInAlbum = Array.isArray(album.songs) ? album.songs : [];
        const inAlbumIds = new Set(songsInAlbum.map(s => String(s._id || s)));
        const safeTitle = this._escapeHtml(album.title || 'Untitled');

        // Resolve the album's owning artist so we can default-filter
        // to that artist's songs (admin shouldn't accidentally add
        // someone else's track to an artist's album).
        const ownerArtistId = String(album.artist?._id || album.artist || '');
        const ownerArtistName = this._escapeHtml(album.artist?.stageName || album.artist?.name || 'Album artist');

        // Filter state: 'owner' (default) shows only the album's
        // artist's songs; 'all' shows every song in the system.
        let filterScope = 'owner';

        const handle = Modal.show({
            title: `Manage Tracks — ${safeTitle}`,
            content: `
                <div class="manage-tracks-modal" style="max-height:60vh; overflow-y:auto;">
                    <div style="margin-bottom:16px;">
                        <h4 style="margin:0 0 8px;">In this album (<span id="amt-in-count">${songsInAlbum.length}</span>)</h4>
                        <div id="amt-in-list" style="background:#0f0f1e; border-radius:8px; padding:8px; min-height:40px;">
                            ${songsInAlbum.length === 0 ? '<p style="color:#888; text-align:center; padding:12px;">No tracks in this album yet.</p>' : ''}
                        </div>
                    </div>

                    <div>
                        <h4 style="margin:0 0 8px;">Available songs</h4>
                        <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
                            <button type="button" id="amt-scope-owner"
                                    style="background:#6c63ff; color:white; border:none; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:13px;">
                                ${ownerArtistName}'s songs
                            </button>
                            <button type="button" id="amt-scope-all"
                                    style="background:transparent; color:#aaa; border:1px solid #2a2a3e; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:13px;">
                                All songs
                            </button>
                        </div>
                        <input type="search" id="amt-search" placeholder="Filter by title..."
                               style="width:100%; box-sizing:border-box; padding:8px; background:#1a1a2e; border:1px solid #2a2a3e; border-radius:6px; color:#fff; margin-bottom:8px;">
                        <div id="amt-available-list" style="background:#0f0f1e; border-radius:8px; padding:8px; min-height:40px;"></div>
                    </div>

                    <div id="amt-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </div>
            `,
            buttons: [
                { text: 'Done', class: 'btn-primary', action: 'close' }
            ]
        });

        const pending = new Set();

        const renderRow = (song, isInAlbum) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #1f1f33;';
            const safeSongTitle = this._escapeHtml(song.title || 'Untitled');
            const safeArtist = this._escapeHtml(song.artist?.stageName || 'Unknown');
            row.innerHTML = `
                <div style="flex:1; min-width:0;">
                    <div style="color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeSongTitle}</div>
                    <div style="color:#888; font-size:12px;">${safeArtist}</div>
                </div>
                <button type="button" class="amt-action btn-icon" title="${isInAlbum ? 'Remove from album' : 'Add to album'}"
                    style="background:${isInAlbum ? '#ff4757' : '#2ecc71'}; color:white; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer;">
                    <i class="fas fa-${isInAlbum ? 'times' : 'plus'}"></i>
                </button>
            `;

            const btn = row.querySelector('.amt-action');
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (pending.has(song._id)) return;
                pending.add(song._id);
                btn.disabled = true;

                const result = isInAlbum
                    ? await albumsAPI.removeSong(album._id, song._id)
                    : await albumsAPI.addSong(album._id, song._id);

                pending.delete(song._id);
                btn.disabled = false;

                if (!result.success) {
                    const errEl = document.getElementById('amt-error');
                    if (errEl) errEl.textContent = result.error || (isInAlbum ? 'Failed to remove' : 'Failed to add');
                    else Toast.show?.(result.error || 'Failed', 'error');
                    return;
                }

                Toast.show?.(isInAlbum ? 'Track removed' : 'Track added', 'success', 1500);
                if (isInAlbum) inAlbumIds.delete(String(song._id));
                else inAlbumIds.add(String(song._id));
                rerender();

                // Update the local cached album so the row's track count
                // reflects the change after the modal closes.
                const idx = this.albums.findIndex(a => a._id === album._id);
                if (idx >= 0) {
                    this.albums[idx].songs = Array.from(inAlbumIds);
                }
            });

            return row;
        };

        const rerender = () => {
            const inList = document.getElementById('amt-in-list');
            const avList = document.getElementById('amt-available-list');
            const inCount = document.getElementById('amt-in-count');
            const searchTerm = (document.getElementById('amt-search')?.value || '').toLowerCase();

            if (inList) {
                inList.innerHTML = '';
                const inSongs = allSongs.filter(s => inAlbumIds.has(String(s._id)));
                if (inSongs.length === 0) {
                    inList.innerHTML = '<p style="color:#888; text-align:center; padding:12px;">No tracks in this album yet.</p>';
                } else {
                    inSongs.forEach(s => inList.appendChild(renderRow(s, true)));
                }
                if (inCount) inCount.textContent = String(inSongs.length);
            }

            if (avList) {
                avList.innerHTML = '';
                const available = allSongs.filter(s => {
                    // Always exclude already-in-album
                    if (inAlbumIds.has(String(s._id))) return false;
                    // Scope filter: 'owner' shows only the album's artist's songs
                    if (filterScope === 'owner' && ownerArtistId) {
                        const songArtistId = String(s.artist?._id || s.artist || '');
                        if (songArtistId !== ownerArtistId) return false;
                    }
                    // Text search filter
                    if (searchTerm) {
                        const t = (s.title || '').toLowerCase();
                        const a = (s.artist?.stageName || '').toLowerCase();
                        if (!t.includes(searchTerm) && !a.includes(searchTerm)) return false;
                    }
                    return true;
                });

                if (available.length === 0) {
                    let msg;
                    if (searchTerm) {
                        msg = 'No songs match your search.';
                    } else if (filterScope === 'owner') {
                        msg = `${ownerArtistName} hasn\u2019t uploaded any other songs yet. Switch to "All songs" to add tracks from other artists.`;
                    } else {
                        msg = 'No songs available to add.';
                    }
                    avList.innerHTML = `<p style="color:#888; text-align:center; padding:12px;">${msg}</p>`;
                } else {
                    // Cap at 100 rendered rows to avoid lag with large catalogs
                    available.slice(0, 100).forEach(s => avList.appendChild(renderRow(s, false)));
                    if (available.length > 100) {
                        const more = document.createElement('p');
                        more.style.cssText = 'color:#888; text-align:center; padding:8px;';
                        more.textContent = `${available.length - 100} more \u2014 use the search above to narrow down.`;
                        avList.appendChild(more);
                    }
                }
            }
        };

        const setScope = (scope) => {
            filterScope = scope;
            const ownerBtn = document.getElementById('amt-scope-owner');
            const allBtn = document.getElementById('amt-scope-all');
            if (ownerBtn && allBtn) {
                const active = 'background:#6c63ff; color:white; border:none;';
                const inactive = 'background:transparent; color:#aaa; border:1px solid #2a2a3e;';
                const common = 'border-radius:6px; padding:6px 12px; cursor:pointer; font-size:13px;';
                ownerBtn.style.cssText = (scope === 'owner' ? active : inactive) + common;
                allBtn.style.cssText = (scope === 'all' ? active : inactive) + common;
            }
            rerender();
        };

        requestAnimationFrame(() => {
            const searchInput = document.getElementById('amt-search');
            searchInput?.addEventListener('input', rerender);

            // Disable the owner-scope button if the album has no artist
            // (orphan albums — shouldn't happen but we guard).
            const ownerBtn = document.getElementById('amt-scope-owner');
            if (!ownerArtistId && ownerBtn) {
                ownerBtn.disabled = true;
                ownerBtn.title = 'Album has no artist set';
                setScope('all');
            } else {
                ownerBtn?.addEventListener('click', () => setScope('owner'));
            }
            document.getElementById('amt-scope-all')?.addEventListener('click', () => setScope('all'));

            rerender();
        });
    }

    _deleteAlbum(album, rowEl) {
        if (this.processing.has(album._id)) return;
        const doIt = async () => {
            this.processing.add(album._id);
            rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);

            const result = await this.adminAPI.deleteAlbum(album._id);
            this.processing.delete(album._id);

            if (!result.success) {
                Toast.show?.(result.error || 'Failed to delete', 'error');
                rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
                return;
            }

            this.allAlbums = this.allAlbums.filter(a => a._id !== album._id);
            this.albums = this.albums.filter(a => a._id !== album._id);
            if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
            this._renderStats();
            if (this.albums.length === 0) this._renderTable();
            Toast.show?.('Album deleted', 'success');
        };

        if (window.Modal?.confirm) {
            Modal.confirm(`Delete "${album.title}"? Songs in this album will be unlinked, not deleted.`, doIt);
        } else if (confirm(`Delete "${album.title}"?`)) {
            doIt();
        }
    }

    _safeImageUrl(url) {
        if (!url || typeof url !== 'string') return null;
        if (/^javascript:/i.test(url) || /^data:text/i.test(url)) return null;
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

window.AdminAlbumsPage = AdminAlbumsPage;
