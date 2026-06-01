/**
 * Artist Dashboard Page - With All Genres
 */

class ArtistDashboardPage {
    constructor() {
        this.stats = {
            totalStreams: 0,
            totalDownloads: 0,
            totalRevenue: 0,
            monthlyListeners: 0,
            totalSongs: 0
        };
        this.recentSongs = [];
        this.artist = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
        this.showEditProfile = false;
    }

    async render() {
        await this.loadData();
        
        return `
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h1>Artist Dashboard</h1>
                    <button class="btn-outline" id="edit-profile-btn">
                        <i class="fas fa-edit"></i> Edit Profile
                    </button>
                </div>
                
                ${this.showEditProfile ? this.renderEditProfile() : ''}
                
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <h3>Total Streams</h3>
                        <div class="value">${this.formatNumber(this.stats.totalStreams)}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Revenue</h3>
                        <div class="value">K${(this.stats.totalRevenue || 0).toLocaleString()}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Monthly Listeners</h3>
                        <div class="value">${this.formatNumber(this.stats.monthlyListeners)}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Songs</h3>
                        <div class="value">${this.stats.totalSongs || 0}</div>
                    </div>
                </div>
                
                ${this.artist?.subscriptionStatus === 'inactive' ? `
                    <div class="subscription-alert">
                        <i class="fas fa-crown"></i>
                        <div class="alert-content">
                            <strong>Upgrade to Pro</strong>
                            <p>Get unlimited uploads, advanced analytics, and monetization features.</p>
                        </div>
                        <button class="btn-primary" id="upgrade-btn">Upgrade Now</button>
                    </div>
                ` : ''}
                
                <div class="dashboard-section">
                    <h2>Your Songs</h2>
                    <div class="songs-grid" id="artist-songs-grid">
                        ${this.recentSongs.length === 0 ? '<div class="empty-state"><i class="fas fa-music"></i><h3>No songs yet</h3><p>Upload your first song to get started</p></div>' : ''}
                    </div>
                </div>
                
                <div class="dashboard-actions">
                    <button class="btn-primary" id="upload-new-btn">
                        <i class="fas fa-upload"></i> Upload New Song
                    </button>
                    <button class="btn-outline" id="view-earnings-btn">
                        <i class="fas fa-wallet"></i> View Earnings
                    </button>
                    <button class="btn-outline" id="manage-albums-btn">
                        <i class="fas fa-album"></i> Manage Albums
                    </button>
                </div>
            </div>
        `;
    }

    renderEditProfile() {
        const genres = [
            'Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae',
            'Gospel', 'Traditional', 'Amapiano', 'House', 'Pop',
            'Rock', 'Jazz', 'Soul', 'Funk', 'Latin',
            'Cuundu', 'Kalindula'
        ];
        
        return `
            <div class="edit-profile-modal">
                <div class="edit-profile-content">
                    <h3>Edit Artist Profile</h3>
                    <form id="artist-profile-form">
                        <div class="form-group">
                            <label>Stage Name</label>
                            <input type="text" name="stageName" value="${this.escapeHtml(this.artist?.stageName || '')}" required>
                        </div>
                        <div class="form-group">
                            <label>Genres</label>
                            <select name="genres" multiple size="5">
                                ${genres.map(g => `<option value="${g}" ${this.artist?.genres?.includes(g) ? 'selected' : ''}>${g}</option>`).join('')}
                            </select>
                            <small>Hold Ctrl/Cmd to select multiple genres</small>
                        </div>
                        <div class="form-group">
                            <label>Bio</label>
                            <textarea name="bio" rows="4">${this.escapeHtml(this.artist?.bio || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Website</label>
                            <input type="url" name="website" value="${this.escapeHtml(this.artist?.website || '')}">
                        </div>
                        <div class="form-group">
                            <label>Record Label</label>
                            <input type="text" name="recordLabel" value="${this.escapeHtml(this.artist?.recordLabel || '')}">
                        </div>
                        <div class="edit-profile-actions">
                            <button type="submit" class="btn-primary">Save Changes</button>
                            <button type="button" class="btn-secondary" id="cancel-edit">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const artistsAPI = new ArtistsAPI();
            const dashboard = await artistsAPI.getDashboard();
            
            if (dashboard) {
                this.artist = dashboard.artist;
                this.stats = dashboard.stats || {};
                this.recentSongs = dashboard.recentSongs || [];
            }
        } catch (error) {
            console.error('Load dashboard error:', error);
        }
    }

    async afterRender() {
        const uploadBtn = document.getElementById('upload-new-btn');
        const earningsBtn = document.getElementById('view-earnings-btn');
        const upgradeBtn = document.getElementById('upgrade-btn');
        const manageAlbumsBtn = document.getElementById('manage-albums-btn');
        const editProfileBtn = document.getElementById('edit-profile-btn');
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                window.bravoApp.navigateTo('upload');
            });
        }
        
        if (earningsBtn) {
            earningsBtn.addEventListener('click', () => {
                window.bravoApp.navigateTo('earnings');
            });
        }
        
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                window.location.hash = 'subscription';
            });
        }
        
        if (manageAlbumsBtn) {
            manageAlbumsBtn.addEventListener('click', () => {
                window.bravoApp.navigateTo('albums');
            });
        }
        
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                this.showEditProfile = true;
                this.render();
                this.afterRender();
            });
        }
        
        const cancelEdit = document.getElementById('cancel-edit');
        if (cancelEdit) {
            cancelEdit.addEventListener('click', () => {
                this.showEditProfile = false;
                this.render();
                this.afterRender();
            });
        }
        
        const profileForm = document.getElementById('artist-profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(profileForm);
                const artistsAPI = new ArtistsAPI();
                const result = await artistsAPI.updateProfile({
                    stageName: formData.get('stageName'),
                    genres: formData.getAll('genres'),
                    bio: formData.get('bio'),
                    website: formData.get('website'),
                    recordLabel: formData.get('recordLabel')
                });
                
                if (!result.error) {
                    Toast.show('Profile updated successfully!', 'success');
                    this.showEditProfile = false;
                    await this.loadData();
                    this.render();
                    this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        }
        
        const grid = document.getElementById('artist-songs-grid');
        if (grid && this.recentSongs.length > 0) {
            grid.innerHTML = '';
            for (const song of this.recentSongs) {
                const card = await this.createSongCard(song);
                grid.appendChild(card);
            }
        }
    }

    getFullUrl(url) {
        if (!url) return 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    async createSongCard(song) {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-song-id', song._id);
        card.innerHTML = `
            <img src="${this.getFullUrl(song.coverArt)}" alt="${this.escapeHtml(song.title)}" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'">
            <div class="song-card-overlay">
                <button class="play-btn" title="Play"><i class="fas fa-play"></i></button>
                <button class="delete-song-btn" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
            <div class="song-card-info">
                <h4 class="song-title">${this.escapeHtml(song.title)}</h4>
                <p class="song-artist">${song.genre || 'Various'} • Status: <span class="badge ${song.status === 'approved' ? 'badge-success' : 'badge-warning'}">${song.status}</span></p>
                <div class="song-stats">
                    <span><i class="fas fa-play"></i> ${this.formatNumber(song.playCount || 0)}</span>
                    <span><i class="fas fa-download"></i> ${this.formatNumber(song.downloadCount || 0)}</span>
                </div>
            </div>
        `;
        
        const playBtn = card.querySelector('.play-btn');
        const deleteBtn = card.querySelector('.delete-song-btn');
        
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const songWithFullUrl = {
                    ...song,
                    audioUrl: this.getFullUrl(song.audioUrl),
                    coverArt: this.getFullUrl(song.coverArt)
                };
                if (window.bravoApp && window.bravoApp.audioPlayer) {
                    window.bravoApp.audioPlayer.loadSong(songWithFullUrl);
                }
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                Modal.confirm(`Are you sure you want to delete "${song.title}"? This action cannot be undone.`, async () => {
                    const songsAPI = new SongsAPI();
                    const result = await songsAPI.deleteSong(song._id);
                    if (!result.error) {
                        Toast.show('Song deleted successfully', 'success');
                        await this.loadData();
                        this.render();
                        this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                });
            });
        }
        
        return card;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.ArtistDashboardPage = ArtistDashboardPage;