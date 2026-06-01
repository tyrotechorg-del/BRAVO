/**
 * Admin Artists Page - View and Manage All Artists
 */

class AdminArtistsPage {
    constructor() {
        this.artists = [];
        this.isLoading = false;
        this.searchTerm = '';
        this.adminAPI = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadArtists();
        
        return `
            <div class="admin-artists-page">
                <div class="page-header">
                    <h1><i class="fas fa-users"></i> Artists Management</h1>
                    <p>View, verify, and manage all artists on the platform</p>
                </div>
                
                <div class="filters-bar">
                    <div class="search-box">
                        <input type="text" id="artist-search" placeholder="Search by stage name or email..." value="${this.escapeHtml(this.searchTerm)}">
                        <button id="search-btn" class="btn-secondary"><i class="fas fa-search"></i> Search</button>
                        <button id="refresh-btn" class="btn-outline"><i class="fas fa-sync-alt"></i> Refresh</button>
                    </div>
                </div>
                
                <div class="artists-stats">
                    <div class="stat-card-sm">
                        <div class="stat-value">${this.artists.length}</div>
                        <div class="stat-label">Total Artists</div>
                    </div>
                    <div class="stat-card-sm verified">
                        <div class="stat-value">${this.artists.filter(a => a.verified).length}</div>
                        <div class="stat-label">Verified</div>
                    </div>
                    <div class="stat-card-sm featured">
                        <div class="stat-value">${this.artists.filter(a => a.featured).length}</div>
                        <div class="stat-label">Featured</div>
                    </div>
                </div>
                
                <div class="artists-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Avatar</th>
                                <th>Stage Name</th>
                                <th>Email</th>
                                <th>Username</th>
                                <th>Genres</th>
                                <th>Status</th>
                                <th>Verified</th>
                                <th>Featured</th>
                                <th>Monthly Listeners</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="artists-table-body">
                            ${this.renderArtistsList()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async loadArtists() {
        this.isLoading = true;
        
        try {
            const result = await this.adminAPI.getAllArtistsForAdmin(this.searchTerm);
            if (!result.error && result.artists) {
                this.artists = result.artists;
            } else if (!result.error && Array.isArray(result)) {
                this.artists = result;
            } else {
                console.error('Failed to load artists:', result.error);
                this.artists = [];
            }
        } catch (error) {
            console.error('Load artists error:', error);
            this.artists = [];
            Toast.show('Failed to load artists', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    renderArtistsList() {
        if (this.isLoading) {
            return '<tr><td colspan="11" class="loading-cell">Loading artists...</td></tr>';
        }
        
        if (this.artists.length === 0) {
            return '<tr><td colspan="11" class="empty-cell">No artists found</td></tr>';
        }
        
        return this.artists.map(artist => `
            <tr data-artist-id="${artist._id}">
                <td><code class="artist-id" style="font-size: 11px; word-break: break-all;">${artist._id}</code></td>
                <td><img src="${this.getAvatarUrl(artist.avatar)}" class="user-avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=32'"></td>
                <td><strong>${this.escapeHtml(artist.stageName)}</strong></td>
                <td>${this.escapeHtml(artist.email) || 'N/A'}</td>
                <td>${this.escapeHtml(artist.username) || 'N/A'}</td>
                <td><span class="genre-badge">${artist.genres?.slice(0, 2).join(', ') || 'Various'}${artist.genres?.length > 2 ? '...' : ''}</span></td>
                <td><span class="status-badge ${artist.subscriptionStatus === 'active' ? 'active' : 'inactive'}">${artist.subscriptionStatus || 'inactive'}</span></td>
                <td><span class="status-badge ${artist.verified ? 'verified' : 'unverified'}">
                    ${artist.verified ? '<i class="fas fa-check-circle"></i> Verified' : '<i class="fas fa-times-circle"></i> Not Verified'}
                </span></td>
                <td><span class="status-badge ${artist.featured ? 'featured' : 'normal'}">
                    ${artist.featured ? '<i class="fas fa-star"></i> Featured' : 'Normal'}
                </span></td>
                <td>${artist.monthlyListeners?.toLocaleString() || 0}</td>
                <td class="actions-cell">
                    <button class="btn-success verify-artist" data-id="${artist._id}" title="Verify Artist" ${artist.verified ? 'disabled' : ''}>
                        <i class="fas fa-check-circle"></i> Verify
                    </button>
                    <button class="btn-warning feature-artist" data-id="${artist._id}" title="Toggle Featured">
                        <i class="fas fa-star"></i> ${artist.featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button class="btn-icon copy-id-btn" data-id="${artist._id}" title="Copy Artist ID">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-icon view-artist" data-id="${artist._id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
                                        <tr>
                        `).join('');
    }

    getAvatarUrl(avatar) {
        if (!avatar) return 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=32';
        if (avatar.startsWith('http')) return avatar;
        if (avatar.startsWith('/uploads')) return `${this.staticUrl}${avatar}`;
        return avatar;
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Search button
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('artist-search');
        const refreshBtn = document.getElementById('refresh-btn');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                this.searchTerm = searchInput?.value || '';
                await this.loadArtists();
                await this.render();
                await this.afterRender();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                this.searchTerm = '';
                if (searchInput) searchInput.value = '';
                await this.loadArtists();
                await this.render();
                await this.afterRender();
                Toast.show('Artists list refreshed', 'success');
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    this.searchTerm = searchInput.value;
                    await this.loadArtists();
                    await this.render();
                    await this.afterRender();
                }
            });
        }
        
        // Verify artist
        document.querySelectorAll('.verify-artist').forEach(btn => {
            btn.addEventListener('click', async () => {
                const artistId = btn.dataset.id;
                const result = await this.adminAPI.verifyArtist(artistId);
                if (!result.error) {
                    Toast.show('Artist verified successfully!', 'success');
                    await this.loadArtists();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        // Feature/Unfeature artist
        document.querySelectorAll('.feature-artist').forEach(btn => {
            btn.addEventListener('click', async () => {
                const artistId = btn.dataset.id;
                const result = await this.adminAPI.featureArtist(artistId);
                if (!result.error) {
                    Toast.show('Artist featured status updated', 'success');
                    await this.loadArtists();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        // Copy Artist ID
        document.querySelectorAll('.copy-id-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const artistId = btn.dataset.id;
                await navigator.clipboard.writeText(artistId);
                Toast.show('Artist ID copied to clipboard!', 'success');
            });
        });
        
        // View Artist Details
        document.querySelectorAll('.view-artist').forEach(btn => {
            btn.addEventListener('click', async () => {
                const artistId = btn.dataset.id;
                await this.showArtistDetails(artistId);
            });
        });
    }

    async showArtistDetails(artistId) {
        // Find artist from current list or fetch fresh
        let artist = this.artists.find(a => a._id === artistId);
        
        if (!artist) {
            const result = await this.adminAPI.getAllArtistsForAdmin();
            if (!result.error && result.artists) {
                artist = result.artists.find(a => a._id === artistId);
            }
        }
        
        if (!artist) {
            Toast.show('Artist details not found', 'error');
            return;
        }
        
        Modal.show({
            title: `Artist Details: ${artist.stageName}`,
            content: `
                <div class="artist-details-modal" style="max-height: 500px; overflow-y: auto;">
                    <div class="detail-section">
                        <h4><i class="fas fa-user"></i> Basic Information</h4>
                        <p><strong>Artist ID:</strong> <code>${artist._id}</code></p>
                        <p><strong>Stage Name:</strong> ${this.escapeHtml(artist.stageName)}</p>
                        <p><strong>Email:</strong> ${this.escapeHtml(artist.email) || 'N/A'}</p>
                        <p><strong>Username:</strong> ${this.escapeHtml(artist.username) || 'N/A'}</p>
                        <p><strong>Genres:</strong> ${artist.genres?.join(', ') || 'Not specified'}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h4><i class="fas fa-chart-line"></i> Statistics</h4>
                        <p><strong>Monthly Listeners:</strong> ${artist.monthlyListeners?.toLocaleString() || 0}</p>
                        <p><strong>Total Streams:</strong> ${artist.totalStreams?.toLocaleString() || 0}</p>
                        <p><strong>Total Revenue:</strong> K${(artist.totalRevenue || 0).toLocaleString()}</p>
                        <p><strong>Subscription Status:</strong> ${artist.subscriptionStatus || 'inactive'}</p>
                        <p><strong>Current Plan:</strong> ${artist.currentPlan || 'none'}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h4><i class="fas fa-shield-alt"></i> Status</h4>
                        <p><strong>Verified:</strong> ${artist.verified ? 'Yes' : 'No'}</p>
                        <p><strong>Featured:</strong> ${artist.featured ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Close', class: 'btn-secondary', action: 'close' }
            ]
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.AdminArtistsPage = AdminArtistsPage;