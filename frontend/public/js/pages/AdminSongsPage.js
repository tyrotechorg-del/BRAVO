/**
 * Admin Songs Page - Pending Songs Management
 */

class AdminSongsPage {
    constructor() {
        this.pendingSongs = [];
        this.isLoading = false;
        this.apiUrl = window.API_BASE_URL;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        await this.loadData();
        
        return `
            <div class="admin-songs-page">
                <div class="page-header">
                    <h1><i class="fas fa-music"></i> Pending Songs</h1>
                    <p>Review and approve songs uploaded by artists</p>
                </div>
                
                <div class="pending-songs-container">
                    ${this.renderContent()}
                </div>
            </div>
        `;
    }

    async loadData() {
        this.isLoading = true;
        try {
            const adminAPI = new AdminAPI();
            const result = await adminAPI.getPendingSongs();
            if (!result.error) {
                this.pendingSongs = result;
            } else {
                this.pendingSongs = [];
            }
        } catch (error) {
            console.error('Load pending songs error:', error);
            this.pendingSongs = [];
        } finally {
            this.isLoading = false;
        }
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=100';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    renderContent() {
        if (this.isLoading) {
            return '<div class="loading-container"><div class="spinner"></div><p>Loading pending songs...</p></div>';
        }
        
        if (this.pendingSongs.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>No Pending Songs</h3>
                    <p>All songs have been reviewed and approved</p>
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('admin/dashboard')">
                        Back to Dashboard
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="pending-songs-list">
                <h2>${this.pendingSongs.length} Songs Awaiting Approval</h2>
                <div class="songs-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Cover</th>
                                <th>Title</th>
                                <th>Artist</th>
                                <th>Genre</th>
                                <th>Uploaded</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.pendingSongs.map(song => `
                                <tr data-song-id="${song._id}">
                                    <td><img src="${this.getFullUrl(song.coverArt)}" class="song-cover-sm" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50'"></td>
                                    <td><strong>${this.escapeHtml(song.title)}</strong></td>
                                    <td>${song.artist?.stageName || 'Unknown Artist'}</td>
                                    <td><span class="genre-badge">${song.genre || 'Various'}</span></td>
                                    <td>${new Date(song.createdAt).toLocaleDateString()}</td>
                                    <td class="actions-cell">
                                        <button class="btn-success approve-song" data-id="${song._id}" title="Approve Song">
                                            <i class="fas fa-check"></i> Approve
                                        </button>
                                        <button class="btn-danger reject-song" data-id="${song._id}" title="Reject Song">
                                            <i class="fas fa-times"></i> Reject
                                        </button>
                                        <button class="btn-outline play-song" data-url="${this.getFullUrl(song.audioUrl)}" title="Preview">
                                            <i class="fas fa-play"></i> Preview
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Approve song
        document.querySelectorAll('.approve-song').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const songId = btn.dataset.id;
                const adminAPI = new AdminAPI();
                const result = await adminAPI.approveSong(songId);
                if (!result.error) {
                    Toast.show('Song approved successfully!', 'success');
                    await this.loadData();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        // Reject song
        document.querySelectorAll('.reject-song').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const songId = btn.dataset.id;
                const reason = prompt('Enter reason for rejection:');
                if (reason === null) return;
                
                const adminAPI = new AdminAPI();
                const result = await adminAPI.rejectSong(songId, reason);
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
        
        // Preview song
        document.querySelectorAll('.play-song').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = btn.dataset.url;
                if (url && window.bravoApp?.audioPlayer) {
                    window.bravoApp.audioPlayer.loadSong({ 
                        _id: 'preview',
                        title: 'Preview', 
                        artist: { stageName: 'Preview Mode' },
                        audioUrl: url, 
                        coverArt: '' 
                    });
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

window.AdminSongsPage = AdminSongsPage;