/**
 * Admin Dashboard Page - Full Control Over All Routes
 * WITH ARTIST DROPDOWN POPULATION USING IDs
 */

class AdminDashboardPage {
    constructor() {
        this.activeTab = 'overview';
        this.users = [];
        this.pendingSongs = [];
        this.allSongs = [];
        this.withdrawals = [];
        this.reports = [];
        this.comments = [];
        this.albums = [];
        this.artists = [];
        this.artistsList = [];
        this.analytics = null;
        this.revenueAnalytics = null;
        this.settings = null;
        this.isLoading = false;
        this.currentPage = 1;
        this.totalPages = 1;
        this.userRoleFilter = '';
        this.userSearchTerm = '';
        this.adminAPI = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadData();
        
        return `
            <div class="admin-dashboard">
                <h1>Admin Dashboard</h1>
                
                <div class="admin-tabs">
                    <button class="admin-tab ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
                        <i class="fas fa-chart-line"></i> Overview
                    </button>
                    <button class="admin-tab ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users">
                        <i class="fas fa-users"></i> Users
                    </button>
                    <button class="admin-tab ${this.activeTab === 'artists' ? 'active' : ''}" data-tab="artists">
                        <i class="fas fa-music"></i> Artists
                    </button>
                    <button class="admin-tab ${this.activeTab === 'songs' ? 'active' : ''}" data-tab="songs">
                        <i class="fas fa-headphones"></i> Songs
                    </button>
                    <button class="admin-tab ${this.activeTab === 'pending' ? 'active' : ''}" data-tab="pending">
                        <i class="fas fa-clock"></i> Pending Songs
                    </button>
                    <button class="admin-tab ${this.activeTab === 'albums' ? 'active' : ''}" data-tab="albums">
                        <i class="fas fa-album"></i> Albums
                    </button>
                    <button class="admin-tab ${this.activeTab === 'withdrawals' ? 'active' : ''}" data-tab="withdrawals">
                        <i class="fas fa-money-bill-wave"></i> Withdrawals
                    </button>
                    <button class="admin-tab ${this.activeTab === 'reports' ? 'active' : ''}" data-tab="reports">
                        <i class="fas fa-flag"></i> Reports
                    </button>
                    <button class="admin-tab ${this.activeTab === 'comments' ? 'active' : ''}" data-tab="comments">
                        <i class="fas fa-comment"></i> Comments
                    </button>
                    <button class="admin-tab ${this.activeTab === 'analytics' ? 'active' : ''}" data-tab="analytics">
                        <i class="fas fa-chart-bar"></i> Analytics
                    </button>
                    <button class="admin-tab ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
                        <i class="fas fa-cog"></i> Settings
                    </button>
                </div>
                
                <div class="admin-pane ${this.activeTab === 'overview' ? 'active' : ''}" id="overview-pane">
                    ${this.renderOverview()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'users' ? 'active' : ''}" id="users-pane">
                    ${this.renderUsers()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'artists' ? 'active' : ''}" id="artists-pane">
                    ${this.renderArtists()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'songs' ? 'active' : ''}" id="songs-pane">
                    ${this.renderAllSongs()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'pending' ? 'active' : ''}" id="pending-pane">
                    ${this.renderPendingSongs()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'albums' ? 'active' : ''}" id="albums-pane">
                    ${this.renderAlbums()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'withdrawals' ? 'active' : ''}" id="withdrawals-pane">
                    ${this.renderWithdrawals()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'reports' ? 'active' : ''}" id="reports-pane">
                    ${this.renderReports()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'comments' ? 'active' : ''}" id="comments-pane">
                    ${this.renderReportedComments()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'analytics' ? 'active' : ''}" id="analytics-pane">
                    ${this.renderAnalytics()}
                </div>
                
                <div class="admin-pane ${this.activeTab === 'settings' ? 'active' : ''}" id="settings-pane">
                    ${this.renderSettings()}
                </div>
            </div>
        `;
    }

    async loadData() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            if (!this.adminAPI) {
                this.adminAPI = new AdminAPI();
            }
            
            const analyticsResult = await this.adminAPI.getPlatformAnalytics();
            if (!analyticsResult.error) {
                this.analytics = analyticsResult;
            }
            
            const revenueResult = await this.adminAPI.getRevenueAnalytics();
            if (!revenueResult.error) {
                this.revenueAnalytics = revenueResult;
            }
            
            const artistsListResult = await this.adminAPI.getAllArtistsForAdmin();
            if (!artistsListResult.error && artistsListResult.artists) {
                this.artistsList = artistsListResult.artists;
            }
            
            if (this.activeTab === 'users') {
                const usersResult = await this.adminAPI.getAllUsers(this.currentPage, 20, this.userRoleFilter, this.userSearchTerm);
                if (!usersResult.error) {
                    this.users = usersResult.users || [];
                    this.totalPages = usersResult.totalPages || 1;
                }
            }
            
            if (this.activeTab === 'songs' || this.activeTab === 'pending') {
                const songsResult = await this.adminAPI.getPendingSongs();
                if (!songsResult.error) {
                    this.pendingSongs = songsResult;
                }
                
                const allSongsAPI = new SongsAPI();
                const allSongsResult = await allSongsAPI.getAll(1, 100);
                this.allSongs = allSongsResult.songs || [];
            }
            
            if (this.activeTab === 'withdrawals') {
                const withdrawalsResult = await this.adminAPI.getWithdrawals('pending');
                if (!withdrawalsResult.error) {
                    this.withdrawals = withdrawalsResult;
                }
            }
            
            if (this.activeTab === 'reports') {
                const reportsResult = await this.adminAPI.getReports();
                if (!reportsResult.error) {
                    this.reports = reportsResult;
                }
            }
            
            if (this.activeTab === 'comments') {
                const commentsResult = await this.adminAPI.getReportedComments();
                if (!commentsResult.error) {
                    this.comments = commentsResult;
                }
            }
            
            if (this.activeTab === 'settings') {
                const settingsResult = await this.adminAPI.getSystemSettings();
                if (!settingsResult.error) {
                    this.settings = settingsResult;
                }
            }
            
            const artistsAPI = new AdminAPI();
            const artistsResult = await artistsAPI.getAllArtists();
            if (!artistsResult.error) {
                this.artists = artistsResult;
            }
            
            const albumsAPI = new AlbumsAPI();
            const albumsResult = await albumsAPI.getAll(1, 100);
            this.albums = albumsResult.albums || [];
            
        } catch (error) {
            console.error('Load admin data error:', error);
            Toast.show('Failed to load admin data. Please check your connection.', 'error');
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

    renderOverview() {
        const overview = this.analytics?.overview || {};
        const pendingCount = this.pendingSongs.length || 0;
        
        return `
            <div class="dashboard-stats">
                <div class="stat-card">
                    <h3>Total Users</h3>
                    <div class="value">${overview.totalUsers || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Total Artists</h3>
                    <div class="value">${overview.totalArtists || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Total Songs</h3>
                    <div class="value">${overview.totalSongs || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Total Albums</h3>
                    <div class="value">${overview.totalAlbums || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>Pending Songs</h3>
                    <div class="value">${pendingCount}</div>
                </div>
                <div class="stat-card">
                    <h3>Total Revenue</h3>
                    <div class="value">K${(overview.totalRevenue || 0).toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <h3>Platform Commission</h3>
                    <div class="value">K${(overview.platformCommission || 0).toLocaleString()}</div>
                </div>
            </div>
            
            <div class="admin-actions">
                <button class="btn-primary" id="refresh-data-btn">
                    <i class="fas fa-sync-alt"></i> Refresh All Data
                </button>
                <button class="btn-outline" id="trigger-backup-btn">
                    <i class="fas fa-database"></i> Backup Database
                </button>
                <button class="btn-outline" id="admin-upload-song-btn">
                    <i class="fas fa-music"></i> Upload Song
                </button>
                <button class="btn-outline" id="admin-upload-video-btn">
                    <i class="fas fa-video"></i> Upload Video
                </button>
                <button class="btn-outline" id="admin-create-album-btn">
                    <i class="fas fa-album"></i> Create Album
                </button>
            </div>
            
            <div class="growth-stats">
                <h3>Growth (Last 30 Days)</h3>
                <div class="stats-row">
                    <span>📈 New Users: ${overview.growth?.newUsersLast30Days || 0}</span>
                    <span>🎵 New Songs: ${overview.growth?.newSongsLast30Days || 0}</span>
                </div>
            </div>
        `;
    }

    renderUsers() {
        if (this.isLoading && this.activeTab === 'users') {
            return '<div class="loading-container"><div class="spinner"></div><p>Loading users...</p></div>';
        }
        
        return `
            <div class="admin-section-header">
                <h2><i class="fas fa-users"></i> User Management</h2>
                <div class="user-filters">
                    <select id="user-role-filter">
                        <option value="">All Roles</option>
                        <option value="listener">Listeners</option>
                        <option value="artist">Artists</option>
                        <option value="admin">Admins</option>
                    </select>
                    <input type="text" id="user-search" placeholder="Search by name or email..." value="${this.escapeHtml(this.userSearchTerm)}">
                    <button id="search-users-btn" class="btn-secondary"><i class="fas fa-search"></i> Search</button>
                    <button id="reset-users-btn" class="btn-outline"><i class="fas fa-undo"></i> Reset</button>
                </div>
            </div>
            
            <div class="users-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Avatar</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-table-body">
                        ${this.renderUsersList()}
                    </tbody>
                \dable
                ${this.renderPagination()}
            </div>
        `;
    }

    renderUsersList() {
        if (this.users.length === 0) {
            return '<tr><td colspan="7" class="empty-state">No users found</td></tr>';
        }
        
        return this.users.map(user => `
            <tr data-user-id="${user._id}">
                <td><img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'}" class="user-avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'"></td>
                <td><strong>${this.escapeHtml(user.username)}</strong></td>
                <td>${this.escapeHtml(user.email)}</td>
                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                <td><span class="status-badge ${user.isActive ? 'active' : 'inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                <td class="actions-cell">
                    <button class="btn-icon edit-user" data-id="${user._id}" title="Edit User"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon view-user" data-id="${user._id}" title="View Details"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon delete-user" data-id="${user._id}" title="Delete User"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    renderArtists() {
        if (this.artists.length === 0) {
            return '<div class="empty-state"><i class="fas fa-music"></i><h3>No artists found</h3></div>';
        }
        
        return `
            <div class="artists-table-container">
                <h2><i class="fas fa-music"></i> All Artists (${this.artists.length})</h2>
                <div class="artist-search-bar">
                    <input type="text" id="artist-search-input" placeholder="Search artists by name or email...">
                    <button id="search-artists-btn" class="btn-secondary">Search</button>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Avatar</th>
                            <th>Stage Name</th>
                            <th>Email</th>
                            <th>Genres</th>
                            <th>Verified</th>
                            <th>Featured</th>
                            <th>Monthly Listeners</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="artists-table-body">
                        ${this.renderArtistsList()}
                    </tbody>
                \dable
            </div>
        `;
    }

    renderArtistsList() {
        return this.artists.map(artist => `
            <tr data-artist-id="${artist._id}">
                <td><code class="artist-id">${artist._id}</code></td>
                <td><img src="${artist.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=32'}" class="user-avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=32'"></td>
                <td><strong>${this.escapeHtml(artist.stageName)}</strong></td>
                <td>${artist.userId?.email || 'N/A'}</td>
                <td>${artist.genres?.join(', ') || 'Various'}</td>
                <td><span class="status-badge ${artist.verified ? 'active' : 'inactive'}">${artist.verified ? 'Verified' : 'Not Verified'}</span></td>
                <td><span class="status-badge ${artist.featured ? 'active' : 'inactive'}">${artist.featured ? 'Featured' : 'Not Featured'}</span></td>
                <td>${artist.monthlyListeners?.toLocaleString() || 0}</td>
                <td class="actions-cell">
                    <button class="btn-success verify-artist" data-id="${artist._id}" title="Verify Artist"><i class="fas fa-check-circle"></i> Verify</button>
                    <button class="btn-warning feature-artist" data-id="${artist._id}" title="Toggle Featured"><i class="fas fa-star"></i> Feature</button>
                    <button class="btn-icon copy-id-btn" data-id="${artist._id}" title="Copy Artist ID"><i class="fas fa-copy"></i></button>
                    <button class="btn-icon view-artist" data-id="${artist._id}" title="View Details"><i class="fas fa-eye"></i></button>
                </td>
            </tr>
        `).join('');
    }

    renderAllSongs() {
        if (this.allSongs.length === 0) {
            return '<div class="empty-state"><i class="fas fa-headphones"></i><h3>No songs found</h3></div>';
        }
        
        return `
            <div class="songs-table-container">
                <h2><i class="fas fa-headphones"></i> All Songs (${this.allSongs.length})</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Cover</th>
                            <th>Title</th>
                            <th>Artist</th>
                            <th>Genre</th>
                            <th>Status</th>
                            <th>Plays</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.allSongs.map(song => `
                            <tr data-song-id="${song._id}">
                                <td><img src="${this.getFullUrl(song.coverArt)}" class="song-cover-sm" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50'"></td>
                                <td><strong>${this.escapeHtml(song.title)}</strong></td>
                                <td>${song.artist?.stageName || 'Unknown'}</td>
                                <td>${song.genre || 'Various'}</td>
                                <td><span class="status-badge ${song.status === 'approved' ? 'active' : 'warning'}">${song.status}</span></td>
                                <td>${song.playCount?.toLocaleString() || 0}</td>
                                <td class="actions-cell">
                                    <button class="btn-danger delete-song" data-id="${song._id}" title="Delete Song"><i class="fas fa-trash"></i> Delete</button>
                                    <button class="btn-icon play-song" data-url="${this.getFullUrl(song.audioUrl)}" title="Preview"><i class="fas fa-play"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                \dable
            </div>
        `;
    }

    renderPendingSongs() {
        if (this.isLoading && this.activeTab === 'pending') {
            return '<div class="loading-container"><div class="spinner"></div><p>Loading pending songs...</p></div>';
        }
        
        if (this.pendingSongs.length === 0) {
            return '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No pending songs</h3><p>All songs have been reviewed</p></div>';
        }
        
        return `
            <div class="pending-songs-list">
                <h2><i class="fas fa-clock"></i> Songs Awaiting Approval (${this.pendingSongs.length})</h2>
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
                                <td>${song.genre || 'Various'}</td>
                                <td>${new Date(song.createdAt).toLocaleDateString()}</td>
                                <td class="actions-cell">
                                    <button class="btn-success approve-song" data-id="${song._id}">Approve</button>
                                    <button class="btn-danger reject-song" data-id="${song._id}">Reject</button>
                                    <button class="btn-outline play-song" data-url="${this.getFullUrl(song.audioUrl)}">Preview</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                \dable
            </div>
        `;
    }

    renderAlbums() {
        if (this.albums.length === 0) {
            return '<div class="empty-state"><i class="fas fa-album"></i><h3>No albums found</h3></div>';
        }
        
        return `
            <div class="albums-table-container">
                <h2><i class="fas fa-album"></i> All Albums (${this.albums.length})</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Cover</th>
                            <th>Title</th>
                            <th>Artist</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Tracks</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.albums.map(album => `
                            <tr data-album-id="${album._id}">
                                <td><img src="${this.getFullUrl(album.coverArt)}" class="song-cover-sm" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=50'"></td>
                                <td><strong>${this.escapeHtml(album.title)}</strong></td>
                                <td>${album.artist?.stageName || 'Unknown'}</td>
                                <td>${album.type || 'album'}</td>
                                <td><span class="status-badge">${album.status || 'published'}</span></td>
                                <td>${album.songs?.length || 0}</td>
                                <td class="actions-cell">
                                    <button class="btn-danger delete-album" data-id="${album._id}" title="Delete Album"><i class="fas fa-trash"></i> Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                \dable
            </div>
        `;
    }

    renderWithdrawals() {
        if (this.isLoading && this.activeTab === 'withdrawals') {
            return '<div class="loading-container"><div class="spinner"></div><p>Loading withdrawals...</p></div>';
        }
        
        if (this.withdrawals.length === 0) {
            return '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No pending withdrawals</h3><p>All withdrawal requests have been processed</p></div>';
        }
        
        return `
            <div class="withdrawals-list">
                <h2><i class="fas fa-money-bill-wave"></i> Pending Withdrawals (${this.withdrawals.length})</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Requested</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.withdrawals.map(w => `
                            <tr data-id="${w._id}">
                                <td><strong>${this.escapeHtml(w.user?.username || 'Unknown')}</strong></td>
                                <td>K${w.amount.toFixed(2)}</td>
                                <td>${w.method}</td>
                                <td>${new Date(w.createdAt).toLocaleDateString()}</td>
                                <td class="actions-cell">
                                    <button class="btn-success approve-withdrawal" data-id="${w._id}">Approve</button>
                                    <button class="btn-danger reject-withdrawal" data-id="${w._id}">Reject</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                \dable
            </div>
        `;
    }

    renderReports() {
        if (this.isLoading && this.activeTab === 'reports') {
            return '<div class="loading-container"><div class="spinner"></div><p>Loading reports...</p></div>';
        }
        
        if (this.reports.length === 0) {
            return '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No pending reports</h3><p>All user reports have been reviewed</p></div>';
        }
        
        return `
            <div class="reports-list">
                <h2><i class="fas fa-flag"></i> Pending Reports (${this.reports.length})</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Reporter</th>
                            <th>Type</th>
                            <th>Reason</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.reports.map(report => `
                            <tr data-id="${report._id}">
                                <td><strong>${report.reporter?.username}</strong></td>
                                <td>${report.type}</td>
                                <td>${report.reason}</td>
                                <td>${new Date(report.createdAt).toLocaleDateString()}</td>
                                <td class="actions-cell">
                                    <button class="btn-success resolve-report" data-id="${report._id}" data-action="dismiss">Dismiss</button>
                                    <button class="btn-warning resolve-report" data-id="${report._id}" data-action="warn">Warn</button>
                                    <button class="btn-danger resolve-report" data-id="${report._id}" data-action="remove">Remove</button>
                                    <button class="btn-danger resolve-report" data-id="${report._id}" data-action="ban">Ban</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                \dable
            </div>
        `;
    }

    renderReportedComments() {
        if (this.isLoading && this.activeTab === 'comments') {
            return '<div class="loading-container"><div class="spinner"></div><p>Loading reported comments...</p></div>';
        }
        
        if (this.comments.length === 0) {
            return '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No reported comments</h3><p>All comments have been moderated</p></div>';
        }
        
        return `
            <div class="comments-list">
                <h2><i class="fas fa-comment"></i> Reported Comments (${this.comments.length})</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Song</th>
                            <th>Comment</th>
                            <th>Reason</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.comments.map(comment => `
                            <tr data-id="${comment._id}">
                                <td><strong>${comment.user?.username}</strong></td>
                                <td>${comment.song?.title || 'Unknown'}</td>
                                <td class="comment-text">"${this.escapeHtml(comment.content)}"</td>
                                <td>${comment.flaggedReason}</td>
                                <td class="actions-cell">
                                    <button class="btn-danger delete-comment" data-id="${comment._id}">Delete</button>
                                    <button class="btn-warning dismiss-comment" data-id="${comment._id}">Dismiss</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                \dable
            </div>
        `;
    }

    renderAnalytics() {
        const revenue = this.revenueAnalytics || {};
        const monthlyRevenue = revenue.monthly || [];
        const revenueByType = revenue.byType || [];
        
        return `
            <div class="analytics-container">
                <h2><i class="fas fa-chart-line"></i> Revenue Analytics</h2>
                <div class="analytics-section">
                    <h3>Monthly Revenue</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Year</th>
                                <th>Month</th>
                                <th>Total Revenue</th>
                                <th>Commission</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthlyRevenue.map(m => `
                                <tr>
                                    <td>${m._id?.year || 'N/A'}</td>
                                    <td>${m._id?.month || 'N/A'}</td>
                                    <td>K${m.total?.toLocaleString() || 0}</td>
                                    <td>K${m.commission?.toLocaleString() || 0}</td>
                                </tr>
                            `).join('')}
                            ${monthlyRevenue.length === 0 ? '<tr><td colspan="4" class="empty-state">No revenue data available</td></tr>' : ''}
                        </tbody>
                    \dable
                </div>
                
                <div class="analytics-section">
                    <h3>Revenue by Type</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${revenueByType.map(r => `
                                <tr>
                                    <td>${r._id || 'N/A'}</td>
                                    <td>K${r.total?.toLocaleString() || 0}</td>
                                </tr>
                            `).join('')}
                            ${revenueByType.length === 0 ? '<tr><td colspan="2" class="empty-state">No revenue data available</td></tr>' : ''}
                        </tbody>
                    \dable
                </div>
            </div>
        `;
    }

    renderSettings() {
        const settings = this.settings || {};
        
        return `
            <div class="settings-container">
                <h2><i class="fas fa-cog"></i> System Settings</h2>
                <form id="admin-settings-form" class="settings-form">
                    <div class="form-group">
                        <label>Platform Commission Rate (%)</label>
                        <input type="number" name="platformCommission" value="${settings.platformCommission || 20}" step="0.5" min="0" max="100">
                        <small>Percentage taken from each transaction</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Minimum Withdrawal Amount (Kwacha)</label>
                        <input type="number" name="minWithdrawalAmount" value="${settings.minWithdrawalAmount || 50}" step="10" min="10">
                        <small>Minimum amount artists can withdraw</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Maximum Upload Size (MB)</label>
                        <input type="number" name="maxUploadSize" value="${settings.maxUploadSize || 50}" step="5" min="10" max="200">
                        <small>Maximum file size for song uploads</small>
                    </div>
                    
                    <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Save Settings</button>
                </form>
            </div>
        `;
    }

    renderPagination() {
        if (this.totalPages <= 1) return '';
        
        let html = '<div class="pagination-controls">';
        if (this.currentPage > 1) {
            html += `<button class="page-btn" data-page="${this.currentPage - 1}"><i class="fas fa-chevron-left"></i> Previous</button>`;
        }
        html += `<span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>`;
        if (this.currentPage < this.totalPages) {
            html += `<button class="page-btn" data-page="${this.currentPage + 1}">Next <i class="fas fa-chevron-right"></i></button>`;
        }
        html += '</div>';
        
        return html;
    }

    // ============ ADMIN UPLOAD MODALS ============

    async showAdminUploadSongModal() {
        const artistsResult = await this.adminAPI.getAllArtistsForAdmin();
        
        let artistsOptions = '<option value="">Select Artist</option>';
        if (artistsResult.artists && artistsResult.artists.length > 0) {
            artistsOptions += artistsResult.artists.map(artist => 
                `<option value="${artist._id}">${artist.displayName || artist.stageName}</option>`
            ).join('');
        } else {
            artistsOptions += '<option value="" disabled>No artists found</option>';
        }
        
        Modal.show({
            title: 'Admin Upload Song',
            content: `
                <form id="admin-upload-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label>Audio File (MP3) *</label>
                        <input type="file" name="audio" accept="audio/*" required>
                    </div>
                    <div class="form-group">
                        <label>Cover Art (Optional)</label>
                        <input type="file" name="coverArt" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label>Song Title *</label>
                        <input type="text" name="title" required>
                    </div>
                    <div class="form-group">
                        <label>Genre *</label>
                        <select name="genre" required>
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
                            <option value="House">House</option>
                            <option value="Pop">Pop</option>
                            <option value="Rock">Rock</option>
                            <option value="Jazz">Jazz</option>
                            <option value="Soul">Soul</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Artist *</label>
                        <select name="artistId" required>
                            ${artistsOptions}
                        </select>
                        <small>Select artist by ID - this will link the song to their account</small>
                    </div>
                    <div class="form-group">
                        <label>Price (Kwacha)</label>
                        <input type="number" name="price" value="0" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Premium Content</label>
                        <label><input type="checkbox" name="isPremium" value="true"> Make this a premium song</label>
                    </div>
                    <div class="form-group">
                        <label>Tags (comma separated)</label>
                        <input type="text" name="tags" placeholder="afrobeat, zambian, new">
                    </div>
                    <div class="form-group">
                        <label>Lyrics (Optional)</label>
                        <textarea name="lyrics" rows="4" placeholder="Enter song lyrics..."></textarea>
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Upload Song', class: 'btn-primary', action: 'upload', onClick: async () => {
                    const form = document.getElementById('admin-upload-form');
                    const formData = new FormData(form);
                    const audioFile = form.querySelector('[name="audio"]').files[0];
                    const artistId = form.querySelector('[name="artistId"]').value;
                    
                    if (!audioFile) {
                        Toast.show('Please select an audio file', 'warning');
                        return;
                    }
                    if (!artistId) {
                        Toast.show('Please select an artist', 'warning');
                        return;
                    }
                    
                    const result = await this.adminAPI.adminUploadSong(formData);
                    if (!result.error) {
                        Toast.show('Song uploaded successfully!', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
    }

    async showAdminUploadVideoModal() {
        const artistsResult = await this.adminAPI.getAllArtistsForAdmin();
        
        let artistsOptions = '<option value="">Select Artist</option>';
        if (artistsResult.artists && artistsResult.artists.length > 0) {
            artistsOptions += artistsResult.artists.map(artist => 
                `<option value="${artist._id}">${artist.displayName || artist.stageName}</option>`
            ).join('');
        } else {
            artistsOptions += '<option value="" disabled>No artists found</option>';
        }
        
        Modal.show({
            title: 'Admin Upload Video Song',
            content: `
                <form id="admin-video-upload-form" enctype="multipart/form-data">
                    <div class="form-group">
                        <label>Video File (MP4) *</label>
                        <input type="file" name="video" accept="video/*" required>
                    </div>
                    <div class="form-group">
                        <label>Cover Art (Optional)</label>
                        <input type="file" name="coverArt" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label>Song Title *</label>
                        <input type="text" name="title" required>
                    </div>
                    <div class="form-group">
                        <label>Genre *</label>
                        <select name="genre" required>
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
                    </div>
                    <div class="form-group">
                        <label>Artist *</label>
                        <select name="artistId" required>
                            ${artistsOptions}
                        </select>
                        <small>Select artist by ID - this will link the video to their account</small>
                    </div>
                    <div class="form-group">
                        <label>Price (Kwacha)</label>
                        <input type="number" name="price" value="0" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Premium Content</label>
                        <label><input type="checkbox" name="isPremium" value="true"> Make this a premium video</label>
                    </div>
                    <div class="form-group">
                        <label>Tags (comma separated)</label>
                        <input type="text" name="tags" placeholder="afrobeat, zambian, video">
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Upload Video', class: 'btn-primary', action: 'upload', onClick: async () => {
                    const form = document.getElementById('admin-video-upload-form');
                    const formData = new FormData(form);
                    const videoFile = form.querySelector('[name="video"]').files[0];
                    const artistId = form.querySelector('[name="artistId"]').value;
                    
                    if (!videoFile) {
                        Toast.show('Please select a video file', 'warning');
                        return;
                    }
                    if (!artistId) {
                        Toast.show('Please select an artist', 'warning');
                        return;
                    }
                    
                    const result = await this.adminAPI.adminUploadVideo(formData);
                    if (!result.error) {
                        Toast.show('Video uploaded successfully!', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
    }

    async showAdminCreateAlbumModal() {
        const artistsResult = await this.adminAPI.getAllArtistsForAdmin();
        
        let artistsOptions = '<option value="">Select Artist</option>';
        if (artistsResult.artists && artistsResult.artists.length > 0) {
            artistsOptions += artistsResult.artists.map(artist => 
                `<option value="${artist._id}">${artist.displayName || artist.stageName}</option>`
            ).join('');
        } else {
            artistsOptions += '<option value="" disabled>No artists found</option>';
        }
        
        Modal.show({
            title: 'Admin Create Album',
            content: `
                <form id="admin-album-form" enctype="multipart/form-data">
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
                            <option value="Reggae">Reggae</option>
                            <option value="Gospel">Gospel</option>
                            <option value="Traditional">Traditional</option>
                            <option value="Amapiano">Amapiano</option>
                            <option value="Cuundu">Cuundu</option>
                            <option value="Kalindula">Kalindula</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select name="type">
                            <option value="album">Album</option>
                            <option value="ep">EP</option>
                            <option value="single">Single</option>
                            <option value="compilation">Compilation</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Artist *</label>
                        <select name="artistId" required>
                            ${artistsOptions}
                        </select>
                        <small>Select artist - the album will appear under their profile</small>
                    </div>
                    <div class="form-group">
                        <label>Price (Kwacha)</label>
                        <input type="number" name="price" value="0" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>Premium Album</label>
                        <label><input type="checkbox" name="isPremium" value="true"> Make this a premium album</label>
                    </div>
                    <div class="form-group">
                        <label>Songs (comma separated song IDs)</label>
                        <input type="text" name="songs" placeholder="songId1,songId2,songId3">
                        <small>Optional: Add existing song IDs to include in this album</small>
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Create Album', class: 'btn-primary', action: 'create', onClick: async () => {
                    const form = document.getElementById('admin-album-form');
                    const formData = new FormData(form);
                    const coverFile = form.querySelector('[name="coverArt"]').files[0];
                    const artistId = form.querySelector('[name="artistId"]').value;
                    
                    if (!coverFile) {
                        Toast.show('Please select a cover image', 'warning');
                        return;
                    }
                    if (!artistId) {
                        Toast.show('Please select an artist', 'warning');
                        return;
                    }
                    
                    const result = await this.adminAPI.adminUploadAlbum(formData);
                    if (!result.error) {
                        Toast.show('Album created successfully!', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
    }

    async afterRender() {
        this.attachTabListeners();
        this.attachUserListeners();
        this.attachArtistListeners();
        this.attachSongListeners();
        this.attachAlbumListeners();
        this.attachWithdrawalListeners();
        this.attachReportListeners();
        this.attachCommentListeners();
        this.attachSettingsListeners();
        this.attachActionButtons();
        this.attachPaginationListeners();
    }

    attachTabListeners() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activeTab = tab.dataset.tab;
                await this.loadData();
                await this.render();
                await this.afterRender();
            });
        });
    }

    attachUserListeners() {
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                await this.showEditUserModal(userId);
            });
        });
        
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                if (confirm('Delete this user? This action cannot be undone.')) {
                    const result = await this.adminAPI.deleteUser(userId);
                    if (!result.error) {
                        Toast.show('User deleted successfully', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
        
        document.querySelectorAll('.view-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.id;
                await this.showUserDetailsModal(userId);
            });
        });
        
        const searchBtn = document.getElementById('search-users-btn');
        const resetBtn = document.getElementById('reset-users-btn');
        const roleFilter = document.getElementById('user-role-filter');
        const searchInput = document.getElementById('user-search');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                this.userRoleFilter = roleFilter?.value || '';
                this.userSearchTerm = searchInput?.value || '';
                this.currentPage = 1;
                await this.loadData();
                await this.render();
                await this.afterRender();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                this.userRoleFilter = '';
                this.userSearchTerm = '';
                this.currentPage = 1;
                if (roleFilter) roleFilter.value = '';
                if (searchInput) searchInput.value = '';
                await this.loadData();
                await this.render();
                await this.afterRender();
                Toast.show('Filters reset', 'info');
            });
        }
    }

    attachArtistListeners() {
        document.querySelectorAll('.verify-artist').forEach(btn => {
            btn.addEventListener('click', async () => {
                const artistId = btn.dataset.id;
                const result = await this.adminAPI.verifyArtist(artistId);
                if (!result.error) {
                    Toast.show('Artist verified successfully!', 'success');
                    await this.loadData();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        document.querySelectorAll('.feature-artist').forEach(btn => {
            btn.addEventListener('click', async () => {
                const artistId = btn.dataset.id;
                const result = await this.adminAPI.featureArtist(artistId);
                if (!result.error) {
                    Toast.show('Artist featured status toggled', 'success');
                    await this.loadData();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        document.querySelectorAll('.copy-id-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const artistId = btn.dataset.id;
                await navigator.clipboard.writeText(artistId);
                Toast.show('Artist ID copied to clipboard!', 'success');
            });
        });
        
        const searchArtistsBtn = document.getElementById('search-artists-btn');
        const artistSearchInput = document.getElementById('artist-search-input');
        
        if (searchArtistsBtn && artistSearchInput) {
            searchArtistsBtn.addEventListener('click', async () => {
                const searchTerm = artistSearchInput.value.trim();
                const result = await this.adminAPI.getAllArtistsForAdmin(searchTerm);
                if (!result.error && result.artists) {
                    const tbody = document.getElementById('artists-table-body');
                    if (tbody) {
                        tbody.innerHTML = result.artists.map(artist => `
                            <tr data-artist-id="${artist._id}">
                                <td><code class="artist-id">${artist._id}</code></td>
                                <td><img src="${artist.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=32'}" class="user-avatar-sm"></td>
                                <td><strong>${this.escapeHtml(artist.stageName)}</strong></td>
                                <td>${artist.email || 'N/A'}</td>
                                <td>${artist.genres?.join(', ') || 'Various'}</td>
                                <td><span class="status-badge ${artist.verified ? 'active' : 'inactive'}">${artist.verified ? 'Verified' : 'Not Verified'}</span></td>
                                <td><span class="status-badge ${artist.featured ? 'active' : 'inactive'}">${artist.featured ? 'Featured' : 'Not Featured'}</span></td>
                                <td>${artist.monthlyListeners?.toLocaleString() || 0}</td>
                                <td class="actions-cell">
                                    <button class="btn-success verify-artist" data-id="${artist._id}"><i class="fas fa-check-circle"></i> Verify</button>
                                    <button class="btn-warning feature-artist" data-id="${artist._id}"><i class="fas fa-star"></i> Feature</button>
                                    <button class="btn-icon copy-id-btn" data-id="${artist._id}"><i class="fas fa-copy"></i></button>
                                </td>
                            </tr>
                        `).join('');
                        this.attachArtistListeners();
                    }
                }
            });
        }
    }

    attachSongListeners() {
        document.querySelectorAll('.approve-song').forEach(btn => {
            btn.addEventListener('click', async () => {
                const songId = btn.dataset.id;
                const result = await this.adminAPI.approveSong(songId);
                if (!result.error) {
                    Toast.show('Song approved!', 'success');
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
                if (reason === null) return;
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
                        audioUrl: url, title: 'Preview', artist: { stageName: 'Preview' }, coverArt: '' 
                    });
                }
            });
        });
    }

    attachAlbumListeners() {
        document.querySelectorAll('.delete-album').forEach(btn => {
            btn.addEventListener('click', async () => {
                const albumId = btn.dataset.id;
                if (confirm('Delete this album? All songs will be removed from it.')) {
                    const albumsAPI = new AlbumsAPI();
                    const result = await albumsAPI.delete(albumId);
                    if (!result.error) {
                        Toast.show('Album deleted', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
    }

    attachWithdrawalListeners() {
        document.querySelectorAll('.approve-withdrawal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const withdrawalId = btn.closest('tr')?.dataset.id;
                const reference = prompt('Enter transaction reference:');
                if (reference) {
                    const result = await this.adminAPI.processWithdrawal(withdrawalId, 'approve', reference);
                    if (!result.error) {
                        Toast.show('Withdrawal approved', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
        
        document.querySelectorAll('.reject-withdrawal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const withdrawalId = btn.closest('tr')?.dataset.id;
                if (confirm('Reject this withdrawal?')) {
                    const result = await this.adminAPI.processWithdrawal(withdrawalId, 'reject');
                    if (!result.error) {
                        Toast.show('Withdrawal rejected', 'info');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
    }

    attachReportListeners() {
        document.querySelectorAll('.resolve-report').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reportId = btn.closest('tr')?.dataset.id;
                const action = btn.dataset.action;
                const notes = prompt('Enter admin notes:');
                const result = await this.adminAPI.resolveReport(reportId, action, notes || '');
                if (!result.error) {
                    Toast.show('Report resolved', 'success');
                    await this.loadData();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
    }

    attachCommentListeners() {
        document.querySelectorAll('.delete-comment').forEach(btn => {
            btn.addEventListener('click', async () => {
                const commentId = btn.closest('tr')?.dataset.id;
                if (confirm('Delete this comment?')) {
                    const result = await this.adminAPI.deleteComment(commentId);
                    if (!result.error) {
                        Toast.show('Comment deleted', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
        
        document.querySelectorAll('.dismiss-comment').forEach(btn => {
            btn.addEventListener('click', async () => {
                Toast.show('Comment report dismissed', 'info');
                btn.closest('tr')?.remove();
            });
        });
    }

    attachSettingsListeners() {
        const settingsForm = document.getElementById('admin-settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(settingsForm);
                const result = await this.adminAPI.updateSystemSettings({
                    platformCommission: parseFloat(formData.get('platformCommission')),
                    minWithdrawalAmount: parseFloat(formData.get('minWithdrawalAmount')),
                    maxUploadSize: parseFloat(formData.get('maxUploadSize'))
                });
                if (!result.error) {
                    Toast.show('Settings updated successfully', 'success');
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        }
    }

    attachActionButtons() {
        const refreshBtn = document.getElementById('refresh-data-btn');
        const backupBtn = document.getElementById('trigger-backup-btn');
        const uploadSongBtn = document.getElementById('admin-upload-song-btn');
        const uploadVideoBtn = document.getElementById('admin-upload-video-btn');
        const createAlbumBtn = document.getElementById('admin-create-album-btn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                Toast.show('Refreshing data...', 'info');
                await this.loadData();
                await this.render();
                await this.afterRender();
                Toast.show('Data refreshed', 'success');
            });
        }
        
        if (backupBtn) {
            backupBtn.addEventListener('click', async () => {
                const result = await this.adminAPI.triggerBackup();
                if (!result.error) {
                    Toast.show('Backup initiated', 'success');
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        }
        
        if (uploadSongBtn) {
            uploadSongBtn.addEventListener('click', () => {
                this.showAdminUploadSongModal();
            });
        }
        
        if (uploadVideoBtn) {
            uploadVideoBtn.addEventListener('click', () => {
                this.showAdminUploadVideoModal();
            });
        }
        
        if (createAlbumBtn) {
            createAlbumBtn.addEventListener('click', () => {
                this.showAdminCreateAlbumModal();
            });
        }
    }

    attachPaginationListeners() {
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

    async showEditUserModal(userId) {
        const userData = await this.adminAPI.getUserDetails(userId);
        const user = userData.user || {};
        
        Modal.show({
            title: `Edit User: ${user.username}`,
            content: `
                <form id="edit-user-form">
                    <div class="form-group">
                        <label>Status</label>
                        <select name="isActive" id="edit-status">
                            <option value="true" ${user.isActive ? 'selected' : ''}>Active</option>
                            <option value="false" ${!user.isActive ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select name="role" id="edit-role">
                            <option value="listener" ${user.role === 'listener' ? 'selected' : ''}>Listener</option>
                            <option value="artist" ${user.role === 'artist' ? 'selected' : ''}>Artist</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save', class: 'btn-primary', action: 'save', onClick: async () => {
                    const isActive = document.getElementById('edit-status').value === 'true';
                    const role = document.getElementById('edit-role').value;
                    const result = await this.adminAPI.updateUserStatus(userId, isActive, role);
                    if (!result.error) {
                        Toast.show('User updated', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
    }

    async showUserDetailsModal(userId) {
        const userData = await this.adminAPI.getUserDetails(userId);
        const user = userData.user || {};
        const stats = userData.stats || {};
        
        Modal.show({
            title: `User Details: ${user.username}`,
            content: `
                <div class="user-details">
                    <p><strong>Email:</strong> ${this.escapeHtml(user.email)}</p>
                    <p><strong>Full Name:</strong> ${this.escapeHtml(user.fullName)}</p>
                    <p><strong>Role:</strong> ${user.role}</p>
                    <p><strong>Status:</strong> ${user.isActive ? 'Active' : 'Inactive'}</p>
                    <p><strong>Verified:</strong> ${user.isVerified ? 'Yes' : 'No'}</p>
                    <p><strong>Joined:</strong> ${new Date(user.createdAt).toLocaleDateString()}</p>
                    <hr>
                    <h4>Statistics</h4>
                    <p><strong>Total Songs:</strong> ${stats.totalSongs || 0}</p>
                    <p><strong>Total Streams:</strong> ${stats.totalStreams || 0}</p>
                    <p><strong>Total Spent:</strong> K${(stats.totalSpent || 0).toFixed(2)}</p>
                </div>
            `,
            buttons: [{ text: 'Close', class: 'btn-secondary', action: 'close' }]
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.AdminDashboardPage = AdminDashboardPage;