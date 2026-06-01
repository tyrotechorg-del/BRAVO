/**
 * Admin All Songs Page - Complete Management
 */

class AdminAllSongsPage {
    constructor() {
        this.songs = [];
        this.stats = null;
        this.isLoading = false;
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalItems = 0;
        this.filters = {
            status: '',
            genre: '',
            search: '',
            isVideo: ''
        };
        this.selectedSongs = new Set();
        this.adminAPI = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadData();
        
        return `
            <div class="admin-all-songs-page">
                <div class="page-header">
                    <h1><i class="fas fa-headphones"></i> All Songs Management</h1>
                    <p>View, filter, and manage all songs on the platform</p>
                </div>
                
                <div class="stats-cards">
                    <div class="stat-card-sm">
                        <div class="stat-value">${this.stats?.total || 0}</div>
                        <div class="stat-label">Total Songs</div>
                    </div>
                    <div class="stat-card-sm pending">
                        <div class="stat-value">${this.stats?.pending || 0}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                    <div class="stat-card-sm approved">
                        <div class="stat-value">${this.stats?.approved || 0}</div>
                        <div class="stat-label">Approved</div>
                    </div>
                    <div class="stat-card-sm rejected">
                        <div class="stat-value">${this.stats?.rejected || 0}</div>
                        <div class="stat-label">Rejected</div>
                    </div>
                    <div class="stat-card-sm featured">
                        <div class="stat-value">${this.stats?.featured || 0}</div>
                        <div class="stat-label">Featured</div>
                    </div>
                    <div class="stat-card-sm video">
                        <div class="stat-value">${this.stats?.withVideo || 0}</div>
                        <div class="stat-label">Videos</div>
                    </div>
                </div>
                
                <div class="filters-bar">
                    <div class="filter-group">
                        <input type="text" id="search-songs" placeholder="Search by title or tags..." value="${this.escapeHtml(this.filters.search)}">
                        <button id="search-btn" class="btn-secondary"><i class="fas fa-search"></i> Search</button>
                    </div>
                    <div class="filter-group">
                        <select id="status-filter">
                            <option value="">All Status</option>
                            <option value="pending" ${this.filters.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="approved" ${this.filters.status === 'approved' ? 'selected' : ''}>Approved</option>
                            <option value="rejected" ${this.filters.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                            <option value="featured" ${this.filters.status === 'featured' ? 'selected' : ''}>Featured</option>
                        </select>
                        <select id="genre-filter">
                            <option value="">All Genres</option>
                            <option value="Afrobeat">Afrobeat</option>
                            <option value="Hip Hop">Hip Hop</option>
                            <option value="R&B">R&B</option>
                            <option value="Dancehall">Dancehall</option>
                            <option value="Reggae">Reggae</option>
                            <option value="Gospel">Gospel</option>
                            <option value="Traditional">Traditional</option>
                            <option value="Amapiano">Amapiano</option>
                            <option value="Cuundu">Cuundu</option>
                            <option value="Kalindula">Kalindula</option>
                        </select>
                        <select id="type-filter">
                            <option value="">All Types</option>
                            <option value="false">Audio Only</option>
                            <option value="true">Video Songs</option>
                        </select>
                        <button id="apply-filters" class="btn-secondary">Apply Filters</button>
                        <button id="reset-filters" class="btn-outline">Reset</button>
                    </div>
                </div>
                
                <div class="bulk-actions-bar">
                    <span class="selected-count">${this.selectedSongs.size} songs selected</span>
                    <div class="bulk-actions">
                        <select id="bulk-action">
                            <option value="">Bulk Action</option>
                            <option value="approve">Approve Selected</option>
                            <option value="reject">Reject Selected</option>
                            <option value="feature">Feature Selected</option>
                            <option value="delete">Delete Selected</option>
                        </select>
                        <button id="apply-bulk" class="btn-primary">Apply</button>
                    </div>
                </div>
                
                <div class="songs-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" id="select-all"></th>
                                <th>Cover</th>
                                <th>Title</th>
                                <th>Artist</th>
                                <th>Genre</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Plays</th>
                                <th>Likes</th>
                                <th>Uploaded</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="songs-table-body">
                            ${this.renderSongsList()}
                        </tbody>
                    寸able
                    ${this.renderPagination()}
                </div>
            </div>
        `;
    }

    async loadData() {
        this.isLoading = true;
        
        try {
            const result = await this.adminAPI.getAllSongsForAdmin({
                page: this.currentPage,
                limit: 20,
                status: this.filters.status,
                genre: this.filters.genre,
                search: this.filters.search,
                isVideo: this.filters.isVideo
            });
            
            if (!result.error) {
                this.songs = result.songs || [];
                this.stats = result.stats || {};
                this.totalPages = result.pagination?.totalPages || 1;
                this.totalItems = result.pagination?.totalItems || 0;
            }
        } catch (error) {
            console.error('Load songs error:', error);
            Toast.show('Failed to load songs', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    renderSongsList() {
        if (this.isLoading) {
            return '<tr><td colspan="11" class="loading-cell">Loading songs...</td></tr>';
        }
        
        if (this.songs.length === 0) {
            return '<tr><td colspan="11" class="empty-cell">No songs found</td></tr>';
        }
        
        return this.songs.map(song => `
            <tr data-song-id="${song._id}">
                <td><input type="checkbox" class="song-select" value="${song._id}" ${this.selectedSongs.has(song._id) ? 'checked' : ''}></td>
                <td><img src="${this.getFullUrl(song.coverArt)}" class="song-cover-sm" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50'"></td>
                <td><strong>${this.escapeHtml(song.title)}</strong></td>
                <td>${song.artist?.stageName || 'Unknown'}</td>
                <td><span class="genre-badge">${song.genre || 'Various'}</span></td>
                <td>${song.isVideo ? '<span class="type-badge video"><i class="fas fa-video"></i> Video</span>' : '<span class="type-badge audio"><i class="fas fa-music"></i> Audio</span>'}</td>
                <td><span class="status-badge status-${song.status}">${song.status}</span></td>
                <td>${song.playCount?.toLocaleString() || 0}</td>
                <td>${song.likeCount?.toLocaleString() || 0}</td>
                <td>${new Date(song.createdAt).toLocaleDateString()}</td>
                <td class="actions-cell">
                    <button class="btn-icon approve-song" data-id="${song._id}" title="Approve" ${song.status === 'approved' ? 'disabled' : ''}>
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-icon reject-song" data-id="${song._id}" title="Reject" ${song.status === 'rejected' ? 'disabled' : ''}>
                        <i class="fas fa-times"></i>
                    </button>
                    <button class="btn-icon feature-song" data-id="${song._id}" title="Feature" ${song.status === 'featured' ? 'disabled' : ''}>
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="btn-icon delete-song" data-id="${song._id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-icon play-song" data-url="${this.getFullUrl(song.audioUrl)}" title="Preview">
                        <i class="fas fa-play"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderPagination() {
        if (this.totalPages <= 1) return '';
        
        let html = '<div class="pagination-controls">';
        if (this.currentPage > 1) {
            html += `<button class="page-btn" data-page="${this.currentPage - 1}"><i class="fas fa-chevron-left"></i> Previous</button>`;
        }
        html += `<span class="page-info">Page ${this.currentPage} of ${this.totalPages} (${this.totalItems} songs)</span>`;
        if (this.currentPage < this.totalPages) {
            html += `<button class="page-btn" data-page="${this.currentPage + 1}">Next <i class="fas fa-chevron-right"></i></button>`;
        }
        html += '</div>';
        
        return html;
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Search and filters
        const searchBtn = document.getElementById('search-btn');
        const applyFilters = document.getElementById('apply-filters');
        const resetFilters = document.getElementById('reset-filters');
        const searchInput = document.getElementById('search-songs');
        const statusFilter = document.getElementById('status-filter');
        const genreFilter = document.getElementById('genre-filter');
        const typeFilter = document.getElementById('type-filter');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.filters.search = searchInput?.value || '';
                this.currentPage = 1;
                this.loadData().then(() => this.render()).then(() => this.afterRender());
            });
        }
        
        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.filters.status = statusFilter?.value || '';
                this.filters.genre = genreFilter?.value || '';
                this.filters.isVideo = typeFilter?.value || '';
                this.currentPage = 1;
                this.loadData().then(() => this.render()).then(() => this.afterRender());
            });
        }
        
        if (resetFilters) {
            resetFilters.addEventListener('click', () => {
                this.filters = { status: '', genre: '', search: '', isVideo: '' };
                this.currentPage = 1;
                if (searchInput) searchInput.value = '';
                if (statusFilter) statusFilter.value = '';
                if (genreFilter) genreFilter.value = '';
                if (typeFilter) typeFilter.value = '';
                this.loadData().then(() => this.render()).then(() => this.afterRender());
            });
        }
        
        // Select all checkbox
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.song-select');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    if (e.target.checked) {
                        this.selectedSongs.add(cb.value);
                    } else {
                        this.selectedSongs.delete(cb.value);
                    }
                });
                this.updateSelectedCount();
            });
        }
        
        // Individual song selection
        document.querySelectorAll('.song-select').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedSongs.add(e.target.value);
                } else {
                    this.selectedSongs.delete(e.target.value);
                }
                this.updateSelectedCount();
            });
        });
        
        // Bulk action
        const applyBulk = document.getElementById('apply-bulk');
        const bulkAction = document.getElementById('bulk-action');
        
        if (applyBulk) {
            applyBulk.addEventListener('click', async () => {
                const action = bulkAction?.value;
                if (!action) {
                    Toast.show('Please select an action', 'warning');
                    return;
                }
                if (this.selectedSongs.size === 0) {
                    Toast.show('Please select songs to perform action', 'warning');
                    return;
                }
                
                const confirmMsg = `Are you sure you want to ${action} ${this.selectedSongs.size} songs?`;
                if (confirm(confirmMsg)) {
                    const songIds = Array.from(this.selectedSongs);
                    const result = await this.adminAPI.bulkAction(songIds, action);
                    if (!result.error) {
                        Toast.show(`${action} completed for ${songIds.length} songs`, 'success');
                        this.selectedSongs.clear();
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        }
        
        // Individual actions
        document.querySelectorAll('.approve-song').forEach(btn => {
            btn.addEventListener('click', async () => {
                const songId = btn.dataset.id;
                const result = await this.adminAPI.approveSong(songId);
                if (!result.error) {
                    Toast.show('Song approved', 'success');
                    await this.loadData();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        document.querySelectorAll('.reject-song').forEach(btn => {
            btn.addEventListener('click', async () => {
                const songId = btn.dataset.id;
                const reason = prompt('Enter rejection reason:');
                const result = await this.adminAPI.rejectSong(songId, reason);
                if (!result.error) {
                    Toast.show('Song rejected', 'info');
                    await this.loadData();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        document.querySelectorAll('.delete-song').forEach(btn => {
            btn.addEventListener('click', async () => {
                const songId = btn.dataset.id;
                if (confirm('Delete this song permanently?')) {
                    const result = await this.adminAPI.deleteSong(songId);
                    if (!result.error) {
                        Toast.show('Song deleted', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
        
        document.querySelectorAll('.play-song').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url && window.bravoApp?.audioPlayer) {
                    window.bravoApp.audioPlayer.loadSong({ 
                        audioUrl: url, 
                        title: 'Preview', 
                        artist: { stageName: 'Preview' }, 
                        coverArt: '' 
                    });
                }
            });
        });
        
        // Pagination
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                this.currentPage = parseInt(btn.dataset.page);
                await this.loadData();
                await this.render();
                await this.afterRender();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    updateSelectedCount() {
        const countSpan = document.querySelector('.selected-count');
        if (countSpan) {
            countSpan.textContent = `${this.selectedSongs.size} songs selected`;
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.AdminAllSongsPage = AdminAllSongsPage;