

class PlaylistsPage {
    constructor() {
        this.playlists = [];
        this.playlistsAPI = new PlaylistsAPI();
        this.loading = true;
    }

    async render() {
        return `
            <div class="playlists-page">
                <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <h1><i class="fas fa-list"></i> My Playlists</h1>
                        <p id="pl-count" style="color:#888;">Loading...</p>
                    </div>
                    <button id="pl-create-btn" class="btn-primary" type="button">
                        <i class="fas fa-plus"></i> New Playlist
                    </button>
                </div>
                <div id="pl-grid" class="playlists-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px; margin-top:24px;" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in to see your playlists', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        document.getElementById('pl-create-btn')?.addEventListener('click', () => this._showCreateModal());

        await this._loadPlaylists();
        this._render();
    }

    async _loadPlaylists() {
        this.loading = true;
        try {
            const result = await this.playlistsAPI.getUserPlaylists();
            if (result.success) {
                const data = result.data || {};
                this.playlists = data.playlists || data || [];
            } else {
                this.playlists = [];
            }
        } catch (err) {
            console.error('Failed to load playlists', err);
            this.playlists = [];
        }
        this.loading = false;
    }

    _render() {
        const grid = document.getElementById('pl-grid');
        const count = document.getElementById('pl-count');
        if (!grid) return;

        if (count) {
            count.textContent = this.playlists.length === 0
                ? 'You don\u2019t have any playlists yet.'
                : `${this.playlists.length} playlist${this.playlists.length === 1 ? '' : 's'}`;
        }

        if (this.playlists.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <i class="fas fa-list"></i>
                    <h3>No playlists yet</h3>
                    <p>Build a custom mix from songs you love.</p>
                    <button class="btn-primary" type="button" id="pl-empty-create">
                        <i class="fas fa-plus"></i> Create your first playlist
                    </button>
                </div>
            `;
            document.getElementById('pl-empty-create')?.addEventListener('click', () => this._showCreateModal());
            return;
        }

        grid.innerHTML = '';
        this.playlists.forEach(playlist => {
            const card = this._buildCard(playlist);
            grid.appendChild(card);
        });
    }

    _buildCard(p) {
        const safeTitle = this._escapeHtml(p.title || p.name || 'Untitled');
        const safeDescription = this._escapeHtml(p.description || '');
        const songCount = Array.isArray(p.songs) ? p.songs.length : (p.songCount || 0);
        const isPublic = !!p.isPublic;

        const div = document.createElement('div');
        div.className = 'playlist-card';
        div.style.cssText = 'background:#1a1a2e; border-radius:12px; padding:16px; cursor:pointer; transition:transform 0.2s; position:relative;';
        div.onmouseenter = () => (div.style.transform = 'translateY(-4px)');
        div.onmouseleave = () => (div.style.transform = 'none');
        div.innerHTML = `
            <div style="aspect-ratio:1; background:linear-gradient(135deg, #6c63ff, #9b59b6); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:48px; color:white; margin-bottom:12px;">
                <i class="fas fa-music"></i>
            </div>
            <h3 style="font-size:16px; margin:0 0 4px; color:#fff;">${safeTitle}</h3>
            <p style="font-size:12px; color:#888; margin:0;">
                ${songCount} song${songCount === 1 ? '' : 's'}
                ${isPublic ? ' \u2022 <i class="fas fa-globe" style="font-size:10px;"></i> Public' : ' \u2022 <i class="fas fa-lock" style="font-size:10px;"></i> Private'}
            </p>
            ${safeDescription ? `<p style="font-size:12px; color:#aaa; margin:6px 0 0; max-height:32px; overflow:hidden;">${safeDescription}</p>` : ''}
            <button class="pl-delete-btn" type="button" title="Delete playlist"
                style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.5); border:none; color:#ff4757; width:28px; height:28px; border-radius:50%; cursor:pointer; display:none;">
                <i class="fas fa-trash"></i>
            </button>
        `;

        const deleteBtn = div.querySelector('.pl-delete-btn');
        div.addEventListener('mouseenter', () => { if (deleteBtn) deleteBtn.style.display = 'flex'; });
        div.addEventListener('mouseleave', () => { if (deleteBtn) deleteBtn.style.display = 'none'; });

        deleteBtn?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this._confirmDelete(p);
        });

        div.addEventListener('click', () => {
            // Route to a PlaylistView page if one exists; otherwise no-op.
            if (window.bravoApp?.navigateTo) {
                window.bravoApp.navigateTo(`playlist/${p._id}`);
            } else {
                window.location.hash = `playlist/${p._id}`;
            }
        });

        return div;
    }

    async _confirmDelete(playlist) {
        const safeTitle = this._escapeHtml(playlist.title || playlist.name || 'this playlist');
        const proceed = window.Modal?.confirm
            ? await window.Modal.confirm({
                title: 'Delete playlist?',
                message: `This will permanently delete "${safeTitle}". This cannot be undone.`,
                confirmText: 'Delete',
                confirmClass: 'btn-danger'
            })
            : window.confirm(`Delete "${safeTitle}"?`);

        if (!proceed) return;

        const result = await this.playlistsAPI.delete(playlist._id);
        if (result.success) {
            Toast.show?.('Playlist deleted', 'success');
            this.playlists = this.playlists.filter(p => p._id !== playlist._id);
            this._render();
        } else {
            Toast.show?.(result.error || 'Failed to delete playlist', 'error');
        }
    }

    _showCreateModal() {
        if (!window.Modal) {
            Toast.show?.('Modal component not available', 'error');
            return;
        }

        const formHtml = `
            <form id="pl-create-form" onsubmit="return false;">
                <div class="form-group">
                    <label>Title <span style="color:#ff4757;">*</span></label>
                    <input type="text" id="pl-c-title" required maxlength="80" placeholder="My playlist">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="pl-c-description" rows="3" maxlength="300" placeholder="What's this playlist about?"></textarea>
                </div>
                <div class="form-group">
                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="pl-c-public"> Make this playlist public
                    </label>
                </div>
                <div id="pl-c-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
            </form>
        `;

        const handle = window.Modal.show({
            title: 'New Playlist',
            content: formHtml,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Create', class: 'btn-primary', action: 'create' }
            ]
        });

        requestAnimationFrame(() => {
            const createBtn = handle?.element?.querySelector('[data-action="create"]');
            createBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const get = (id) => document.getElementById(id);
                const title = get('pl-c-title')?.value.trim() || '';
                const description = get('pl-c-description')?.value.trim() || '';
                const isPublic = !!get('pl-c-public')?.checked;

                const showError = (msg) => {
                    const el = get('pl-c-error');
                    if (el) el.textContent = msg;
                    else if (msg) Toast.show?.(msg, 'error');
                };
                showError('');

                if (!title) { showError('Title is required'); return; }

                createBtn.disabled = true;
                createBtn.textContent = 'Creating...';

                const result = await this.playlistsAPI.create({ title, description, isPublic });

                createBtn.disabled = false;
                createBtn.textContent = 'Create';

                if (!result.success) {
                    showError(result.error || 'Failed to create playlist');
                    return;
                }

                handle?.close?.();
                Toast.show?.('Playlist created', 'success');
                await this._loadPlaylists();
                this._render();
            }, true);
        });
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.PlaylistsPage = PlaylistsPage;
