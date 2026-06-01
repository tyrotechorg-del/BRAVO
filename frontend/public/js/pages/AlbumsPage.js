/**
 * Albums Management Page
 */

class AlbumsPage {
    constructor() {
        this.trendingAlbums = [];
        this.myAlbums = [];
        this.showCreateForm = false;
        this.selectedAlbum = null;
        this.activeTab = 'trending';
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        await this.loadData();
        
        return `
            <div class="albums-container">
                <div class="albums-header">
                    <h1>Albums</h1>
                    <button class="btn-primary" id="create-album-btn">
                        <i class="fas fa-plus"></i> Create Album
                    </button>
                </div>
                
                <div class="albums-tabs">
                    <button class="albums-tab ${this.activeTab === 'trending' ? 'active' : ''}" data-tab="trending">Trending Albums</button>
                    <button class="albums-tab ${this.activeTab === 'my-albums' ? 'active' : ''}" data-tab="my-albums">My Albums</button>
                </div>
                
                <div class="albums-pane ${this.activeTab === 'trending' ? 'active' : ''}" id="trending-pane">
                    ${this.renderTrendingAlbums()}
                </div>
                
                <div class="albums-pane ${this.activeTab === 'my-albums' ? 'active' : ''}" id="my-albums-pane">
                    ${this.renderMyAlbums()}
                </div>
            </div>
        `;
    }

    async loadData() {
        const albumsAPI = new AlbumsAPI();
        this.trendingAlbums = await albumsAPI.getTrending();
        
        const token = localStorage.getItem('bravo_token');
        if (token) {
            this.myAlbums = await albumsAPI.getMyAlbums();
        }
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    renderTrendingAlbums() {
        if (this.trendingAlbums.length === 0) {
            return '<div class="empty-state"><i class="fas fa-music"></i><h3>No trending albums</h3></div>';
        }
        
        return `
            <div class="albums-grid">
                ${this.trendingAlbums.map(album => `
                    <div class="album-card" data-album-id="${album._id}">
                        <img src="${this.getFullUrl(album.coverArt)}" alt="${this.escapeHtml(album.title)}" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'">
                        <div class="album-overlay">
                            <button class="play-album-btn" data-id="${album._id}" data-songs='${JSON.stringify(album.songs || [])}'>
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="view-album-btn" data-id="${album._id}">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </div>
                        <div class="album-info">
                            <h4>${this.escapeHtml(album.title)}</h4>
                            <p>${album.artist?.stageName || 'Unknown Artist'}</p>
                            <span>${album.songs?.length || 0} tracks</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderMyAlbums() {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            return '<div class="empty-state"><i class="fas fa-lock"></i><h3>Login to view your albums</h3><button class="btn-primary" onclick="window.bravoApp.navigateTo(\'login\')">Login</button></div>';
        }
        
        if (this.myAlbums.length === 0) {
            return '<div class="empty-state"><i class="fas fa-folder-open"></i><h3>No albums yet</h3><p>Create your first album</p></div>';
        }
        
        return `
            <div class="albums-grid">
                ${this.myAlbums.map(album => `
                    <div class="album-card editable" data-album-id="${album._id}">
                        <img src="${this.getFullUrl(album.coverArt)}" alt="${this.escapeHtml(album.title)}" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'">
                        <div class="album-overlay">
                            <button class="edit-album-btn" data-id="${album._id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-album-btn" data-id="${album._id}">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="view-album-btn" data-id="${album._id}">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </div>
                        <div class="album-info">
                            <h4>${this.escapeHtml(album.title)}</h4>
                            <p>${album.songs?.length || 0} tracks</p>
                            <span class="album-status">${album.status || 'draft'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        const createBtn = document.getElementById('create-album-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.showCreateAlbumModal();
            });
        }
        
        document.querySelectorAll('.albums-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this.render();
                this.afterRender();
            });
        });
        
        document.querySelectorAll('.view-album-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const albumId = btn.dataset.id;
                const albumsAPI = new AlbumsAPI();
                this.selectedAlbum = await albumsAPI.getById(albumId);
                this.showAlbumDetailModal();
            });
        });
        
        document.querySelectorAll('.edit-album-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const albumId = btn.dataset.id;
                await this.showEditAlbumModal(albumId);
            });
        });
        
        document.querySelectorAll('.delete-album-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const albumId = btn.dataset.id;
                Modal.confirm('Are you sure you want to delete this album? All songs will be removed from the album.', async () => {
                    const albumsAPI = new AlbumsAPI();
                    const result = await albumsAPI.delete(albumId);
                    if (!result.error) {
                        Toast.show('Album deleted successfully', 'success');
                        await this.loadData();
                        this.render();
                        this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                });
            });
        });
        
        document.querySelectorAll('.play-album-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const songs = JSON.parse(btn.dataset.songs || '[]');
                if (songs.length > 0 && window.bravoApp?.audioPlayer) {
                    window.bravoApp.audioPlayer.loadSong(songs[0], songs);
                }
            });
        });
    }

    showCreateAlbumModal() {
        Modal.show({
            title: 'Create New Album',
            content: `
                <form id="create-album-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label>Album Title *</label>
                        <input type="text" name="title" required>
                    </div>
                    <div class="form-group">
                        <label>Cover Art *</label>
                        <input type="file" name="coverArt" accept="image/*" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Genre</label>
                        <select name="genre">
                            <option value="">Select Genre</option>
                            <option value="Afrobeat">Afrobeat</option>
                            <option value="Hip Hop">Hip Hop</option>
                            <option value="R&B">R&B</option>
                            <option value="Dancehall">Dancehall</option>
                            <option value="Amapiano">Amapiano</option>
                            <option value="Gospel">Gospel</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select name="type">
                            <option value="album">Album</option>
                            <option value="ep">EP</option>
                            <option value="single">Single</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Price (Kwacha)</label>
                        <input type="number" name="price" value="0" step="0.01">
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Create Album', class: 'btn-primary', action: 'create', onClick: async () => {
                    const form = document.getElementById('create-album-form');
                    const formData = new FormData(form);
                    
                    const coverFile = form.querySelector('[name="coverArt"]').files[0];
                    if (!coverFile) {
                        Toast.show('Please select a cover image', 'warning');
                        return;
                    }
                    
                    const albumsAPI = new AlbumsAPI();
                    const result = await albumsAPI.create(formData);
                    
                    if (!result.error) {
                        Toast.show('Album created successfully!', 'success');
                        await this.loadData();
                        this.render();
                        this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
    }

    async showEditAlbumModal(albumId) {
        const albumsAPI = new AlbumsAPI();
        const album = await albumsAPI.getById(albumId);
        
        Modal.show({
            title: `Edit Album: ${album.title}`,
            content: `
                <form id="edit-album-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label>Album Title</label>
                        <input type="text" name="title" value="${this.escapeHtml(album.title)}" required>
                    </div>
                    <div class="form-group">
                        <label>New Cover Art (Optional)</label>
                        <input type="file" name="coverArt" accept="image/*">
                        <small>Current: <img src="${this.getFullUrl(album.coverArt)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></small>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="3">${this.escapeHtml(album.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Genre</label>
                        <select name="genre">
                            <option value="">Select Genre</option>
                            <option value="Afrobeat" ${album.genre === 'Afrobeat' ? 'selected' : ''}>Afrobeat</option>
                            <option value="Hip Hop" ${album.genre === 'Hip Hop' ? 'selected' : ''}>Hip Hop</option>
                            <option value="R&B" ${album.genre === 'R&B' ? 'selected' : ''}>R&B</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Price (Kwacha)</label>
                        <input type="number" name="price" value="${album.price}" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="draft" ${album.status === 'draft' ? 'selected' : ''}>Draft</option>
                            <option value="published" ${album.status === 'published' ? 'selected' : ''}>Published</option>
                        </select>
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save Changes', class: 'btn-primary', action: 'save', onClick: async () => {
                    const form = document.getElementById('edit-album-form');
                    const formData = new FormData(form);
                    
                    const albumsAPI = new AlbumsAPI();
                    let result;
                    
                    if (form.querySelector('[name="coverArt"]').files[0]) {
                        result = await albumsAPI.updateWithCover(albumId, formData);
                    } else {
                        const data = {
                            title: formData.get('title'),
                            description: formData.get('description'),
                            genre: formData.get('genre'),
                            price: parseFloat(formData.get('price')),
                            status: formData.get('status')
                        };
                        result = await albumsAPI.update(albumId, data);
                    }
                    
                    if (!result.error) {
                        Toast.show('Album updated successfully', 'success');
                        await this.loadData();
                        this.render();
                        this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
    }

    showAlbumDetailModal() {
        const album = this.selectedAlbum;
        if (!album) return;
        
        Modal.show({
            title: album.title,
            content: `
                <div class="album-detail-view">
                    <img src="${this.getFullUrl(album.coverArt)}" class="album-detail-cover" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'">
                    <div class="album-detail-info">
                        <p><strong>Artist:</strong> ${album.artist?.stageName}</p>
                        <p><strong>Genre:</strong> ${album.genre || 'Various'}</p>
                        <p><strong>Type:</strong> ${album.type}</p>
                        <p><strong>Release Date:</strong> ${new Date(album.releaseDate).toLocaleDateString()}</p>
                        <p><strong>Total Songs:</strong> ${album.songs?.length || 0}</p>
                        <p><strong>Total Streams:</strong> ${album.totalStreams || 0}</p>
                        ${album.description ? `<p><strong>Description:</strong> ${this.escapeHtml(album.description)}</p>` : ''}
                    </div>
                </div>
                
                <div class="album-songs-section">
                    <h3>Tracklist</h3>
                    <div class="album-songs-list">
                        ${album.songs?.map((song, index) => `
                            <div class="album-song-item">
                                <div class="song-number">${index + 1}</div>
                                <div class="song-info">
                                    <div class="song-title">${this.escapeHtml(song.title)}</div>
                                    <div class="song-duration">${this.formatDuration(song.duration)}</div>
                                </div>
                                <div class="song-actions">
                                    <button class="btn-icon play-song-from-album" data-song='${JSON.stringify(song)}'>
                                        <i class="fas fa-play"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') || '<div class="empty-state">No songs in this album</div>'}
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Close', class: 'btn-secondary', action: 'close' }
            ]
        });
        
        setTimeout(() => {
            document.querySelectorAll('.play-song-from-album').forEach(btn => {
                btn.addEventListener('click', () => {
                    const song = JSON.parse(btn.dataset.song);
                    if (window.bravoApp?.audioPlayer) {
                        window.bravoApp.audioPlayer.loadSong(song);
                    }
                });
            });
        }, 100);
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.AlbumsPage = AlbumsPage;