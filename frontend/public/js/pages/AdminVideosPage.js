/**
 * Admin Videos Page - Manage All Video Songs
 */

class AdminVideosPage {
    constructor() {
        this.videos = [];
        this.isLoading = false;
        this.statusFilter = 'all';
        this.adminAPI = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadVideos();
        
        return `
            <div class="admin-videos-page">
                <div class="page-header">
                    <h1><i class="fas fa-video"></i> Videos Management</h1>
                    <p>View and manage all video songs on the platform</p>
                </div>
                
                <div class="videos-stats">
                    <div class="stat-card-sm">
                        <div class="stat-value">${this.videos.length}</div>
                        <div class="stat-label">Total Videos</div>
                    </div>
                    <div class="stat-card-sm approved">
                        <div class="stat-value">${this.videos.filter(v => v.status === 'approved').length}</div>
                        <div class="stat-label">Approved</div>
                    </div>
                    <div class="stat-card-sm pending">
                        <div class="stat-value">${this.videos.filter(v => v.status === 'pending').length}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                </div>
                
                <div class="filters-bar">
                    <select id="status-filter" class="filter-select">
                        <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>All Videos</option>
                        <option value="approved" ${this.statusFilter === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="pending" ${this.statusFilter === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="rejected" ${this.statusFilter === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                    <button id="refresh-btn" class="btn-outline"><i class="fas fa-sync-alt"></i> Refresh</button>
                </div>
                
                <div class="videos-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Thumbnail</th>
                                <th>Title</th>
                                <th>Artist</th>
                                <th>Genre</th>
                                <th>Views</th>
                                <th>Status</th>
                                <th>Uploaded</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="videos-table-body">
                            ${this.renderVideosList()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async loadVideos() {
        this.isLoading = true;
        
        try {
            const songsAPI = new SongsAPI();
            const result = await songsAPI.getAllVideos();
            if (!result.error) {
                let videos = result.videos || [];
                if (this.statusFilter !== 'all') {
                    videos = videos.filter(v => v.status === this.statusFilter);
                }
                this.videos = videos;
            } else {
                this.videos = [];
            }
        } catch (error) {
            console.error('Load videos error:', error);
            this.videos = [];
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

    renderVideosList() {
        if (this.isLoading) {
            return '<tr><td colspan="8" class="loading-cell">Loading videos...</td></tr>';
        }
        
        if (this.videos.length === 0) {
            return '<tr><td colspan="8" class="empty-cell">No videos found</td></tr>';
        }
        
        return this.videos.map(video => `
            <tr data-video-id="${video._id}">
                <td><img src="${this.getFullUrl(video.coverArt)}" class="video-thumb-sm" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50'"></td>
                <td><strong>${this.escapeHtml(video.title)}</strong></td>
                <td>${video.artist?.stageName || 'Unknown'}</td>
                <td><span class="genre-badge">${video.genre || 'Various'}</span></td>
                <td>${video.playCount?.toLocaleString() || 0}</td>
                <td><span class="status-badge ${video.status}">${video.status}</span></td>
                <td>${new Date(video.createdAt).toLocaleDateString()}</td>
                <td class="actions-cell">
                    <button class="btn-icon play-video" data-url="${this.getFullUrl(video.videoUrl)}" title="Play Video">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn-icon view-video" data-id="${video._id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${video.status === 'pending' ? `
                        <button class="btn-success approve-video" data-id="${video._id}" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-danger reject-video" data-id="${video._id}" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    <button class="btn-danger delete-video" data-id="${video._id}" title="Delete">
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
        const statusFilter = document.getElementById('status-filter');
        const refreshBtn = document.getElementById('refresh-btn');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', async () => {
                this.statusFilter = statusFilter.value;
                await this.loadVideos();
                await this.render();
                await this.afterRender();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadVideos();
                await this.render();
                await this.afterRender();
                Toast.show('Videos refreshed', 'success');
            });
        }
        
        document.querySelectorAll('.play-video').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) {
                    window.open(url, '_blank');
                }
            });
        });
        
        document.querySelectorAll('.approve-video').forEach(btn => {
            btn.addEventListener('click', async () => {
                const videoId = btn.dataset.id;
                const result = await this.adminAPI.approveSong(videoId);
                if (!result.error) {
                    Toast.show('Video approved', 'success');
                    await this.loadVideos();
                    await this.render();
                    await this.afterRender();
                }
            });
        });
        
        document.querySelectorAll('.reject-video').forEach(btn => {
            btn.addEventListener('click', async () => {
                const videoId = btn.dataset.id;
                const reason = prompt('Enter rejection reason:');
                const result = await this.adminAPI.rejectSong(videoId, reason);
                if (!result.error) {
                    Toast.show('Video rejected', 'info');
                    await this.loadVideos();
                    await this.render();
                    await this.afterRender();
                }
            });
        });
        
        document.querySelectorAll('.delete-video').forEach(btn => {
            btn.addEventListener('click', async () => {
                const videoId = btn.dataset.id;
                if (confirm('Delete this video permanently?')) {
                    const result = await this.adminAPI.deleteSong(videoId);
                    if (!result.error) {
                        Toast.show('Video deleted', 'success');
                        await this.loadVideos();
                        await this.render();
                        await this.afterRender();
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

window.AdminVideosPage = AdminVideosPage;