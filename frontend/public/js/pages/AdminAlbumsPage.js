/**
 * Admin Albums Page - Manage All Albums
 */

class AdminAlbumsPage {
    constructor() {
        this.albums = [];
        this.isLoading = false;
        this.searchTerm = '';
        this.adminAPI = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadAlbums();
        
        return `
            <div class="admin-albums-page">
                <div class="page-header">
                    <h1><i class="fas fa-album"></i> Albums Management</h1>
                    <p>View and manage all albums on the platform</p>
                </div>
                
                <div class="albums-stats">
                    <div class="stat-card-sm">
                        <div class="stat-value">${this.albums.length}</div>
                        <div class="stat-label">Total Albums</div>
                    </div>
                    <div class="stat-card-sm published">
                        <div class="stat-value">${this.albums.filter(a => a.status === 'published').length}</div>
                        <div class="stat-label">Published</div>
                    </div>
                    <div class="stat-card-sm draft">
                        <div class="stat-value">${this.albums.filter(a => a.status === 'draft').length}</div>
                        <div class="stat-label">Draft</div>
                    </div>
                </div>
                
                <div class="filters-bar">
                    <div class="search-box">
                        <input type="text" id="album-search" placeholder="Search by title or artist..." value="${this.escapeHtml(this.searchTerm)}">
                        <button id="search-btn" class="btn-secondary"><i class="fas fa-search"></i> Search</button>
                        <button id="refresh-btn" class="btn-outline"><i class="fas fa-sync-alt"></i> Refresh</button>
                    </div>
                </div>
                
                <div class="albums-table-container">
                    <table class="data-table">
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
                        <tbody id="albums-table-body">
                            ${this.renderAlbumsList()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async loadAlbums() {
        this.isLoading = true;
        
        try {
            const result = await this.adminAPI.getAllAlbums();
            if (!result.error) {
                this.albums = result;
            } else {
                this.albums = [];
            }
        } catch (error) {
            console.error('Load albums error:', error);
            this.albums = [];
        } finally {
            this.isLoading = false;
        }
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    renderAlbumsList() {
        if (this.isLoading) {
            return '<tr><td colspan="9" class="loading-cell">Loading albums...</td></tr>';
        }
        
        if (this.albums.length === 0) {
            return '<tr><td colspan="9" class="empty-cell">No albums found</td></tr>';
        }
        
        return this.albums.map(album => `
            <tr data-album-id="${album._id}">
                <td><img src="${this.getFullUrl(album.coverArt)}" class="album-cover-sm" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50'"></td>
                <td><strong>${this.escapeHtml(album.title)}</strong></td>
                <td>${album.artist?.stageName || 'Unknown'}</td>
                <td><span class="genre-badge">${album.genre || 'Various'}</span></td>
                <td><span class="type-badge ${album.type}">${album.type || 'album'}</span></td>
                <td>${album.songs?.length || 0} songs</td>
                <td><span class="status-badge ${album.status}">${album.status || 'draft'}</span></td>
                <td>${new Date(album.releaseDate).toLocaleDateString()}</td>
                <td class="actions-cell">
                    <button class="btn-icon view-album" data-id="${album._id}" title="View Album">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-danger delete-album" data-id="${album._id}" title="Delete Album">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('album-search');
        const refreshBtn = document.getElementById('refresh-btn');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                this.searchTerm = searchInput?.value || '';
                await this.loadAlbums();
                await this.render();
                await this.afterRender();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                this.searchTerm = '';
                if (searchInput) searchInput.value = '';
                await this.loadAlbums();
                await this.render();
                await this.afterRender();
                Toast.show('Albums refreshed', 'success');
            });
        }
        
        document.querySelectorAll('.view-album').forEach(btn => {
            btn.addEventListener('click', async () => {
                const albumId = btn.dataset.id;
                window.location.hash = `album/${albumId}`;
            });
        });
        
        document.querySelectorAll('.delete-album').forEach(btn => {
            btn.addEventListener('click', async () => {
                const albumId = btn.dataset.id;
                if (confirm('Delete this album permanently? All songs will be removed.')) {
                    const result = await this.adminAPI.deleteAlbum(albumId);
                    if (!result.error) {
                        Toast.show('Album deleted successfully', 'success');
                        await this.loadAlbums();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.AdminAlbumsPage = AdminAlbumsPage;