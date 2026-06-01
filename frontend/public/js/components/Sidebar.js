/**
 * Sidebar Component - Complete with All Admin Routes
 */

class Sidebar {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.render();
    }

    render() {
        if (!this.container) return;
        
        const auth = new AuthAPI();
        const user = auth.getUser();
        const role = user?.role || 'listener';
        
        this.container.innerHTML = `
            <div class="sidebar">
                <div class="sidebar-section">
                    <h3>MAIN</h3>
                    <ul class="sidebar-nav">
                        <li class="sidebar-item" data-page="home">
                            <i class="fas fa-home"></i> Home
                        </li>
                        <li class="sidebar-item" data-page="browse">
                            <i class="fas fa-compass"></i> Browse
                        </li>
                        <li class="sidebar-item" data-page="trending">
                            <i class="fas fa-fire"></i> Trending
                        </li>
                        <li class="sidebar-item" data-page="videos">
                            <i class="fas fa-video"></i> Videos
                        </li>
                    </ul>
                </div>
                
                <div class="sidebar-section">
                    <h3>YOUR LIBRARY</h3>
                    <ul class="sidebar-nav">
                        <li class="sidebar-item" data-page="liked">
                            <i class="fas fa-heart"></i> Liked Songs
                        </li>
                        <li class="sidebar-item" data-page="recent">
                            <i class="fas fa-history"></i> Recently Played
                        </li>
                        <li class="sidebar-item" data-page="downloads">
                            <i class="fas fa-download"></i> Downloads
                        </li>
                        <li class="sidebar-item" data-page="playlists">
                            <i class="fas fa-list"></i> Playlists
                        </li>
                        <li class="sidebar-item" data-page="albums">
                            <i class="fas fa-album"></i> Albums
                        </li>
                    </ul>
                </div>
                
                ${role === 'artist' ? `
                    <div class="sidebar-section">
                        <h3>ARTIST HUB</h3>
                        <ul class="sidebar-nav">
                            <li class="sidebar-item" data-page="dashboard">
                                <i class="fas fa-chart-line"></i> Dashboard
                            </li>
                            <li class="sidebar-item" data-page="upload">
                                <i class="fas fa-upload"></i> Upload
                            </li>
                            <li class="sidebar-item" data-page="earnings">
                                <i class="fas fa-wallet"></i> Earnings
                            </li>
                            <li class="sidebar-item" data-page="artist/albums">
                                <i class="fas fa-album"></i> My Albums
                            </li>
                            <li class="sidebar-item" data-page="artist/videos">
                                <i class="fas fa-video"></i> My Videos
                            </li>
                        </ul>
                    </div>
                ` : ''}
                
                ${role === 'admin' ? `
                    <div class="sidebar-section">
                        <h3>ADMIN PANEL</h3>
                        <ul class="sidebar-nav">
                            <li class="sidebar-item" data-page="admin/dashboard">
                                <i class="fas fa-chart-bar"></i> Overview
                            </li>
                            <li class="sidebar-item" data-page="admin/all-songs">
                                <i class="fas fa-headphones"></i> All Songs
                            </li>
                            <li class="sidebar-item" data-page="admin/pending">
                                <i class="fas fa-clock"></i> Pending Songs
                            </li>
                            <li class="sidebar-item" data-page="admin/videos">
                                <i class="fas fa-video"></i> Videos
                            </li>
                            <li class="sidebar-item" data-page="admin/albums">
                                <i class="fas fa-album"></i> Albums
                            </li>
                            <li class="sidebar-item" data-page="admin/users">
                                <i class="fas fa-users"></i> Users
                            </li>
                            <li class="sidebar-item" data-page="admin/artists">
                                <i class="fas fa-user-musician"></i> Artists
                            </li>
                            <li class="sidebar-item" data-page="admin/withdrawals">
                                <i class="fas fa-money-bill-wave"></i> Withdrawals
                            </li>
                            <li class="sidebar-item" data-page="admin/reports">
                                <i class="fas fa-flag"></i> Reports
                            </li>
                            <li class="sidebar-item" data-page="admin/comments">
                                <i class="fas fa-comment"></i> Reported Comments
                            </li>
                            <li class="sidebar-item" data-page="admin/settings">
                                <i class="fas fa-cog"></i> Settings
                            </li>
                        </ul>
                    </div>
                ` : ''}
                
                <div class="sidebar-footer">
                    <div class="sidebar-item" data-page="settings">
                        <i class="fas fa-cog"></i> Settings
                    </div>
                    ${role === 'listener' ? `
                        <div class="sidebar-item" data-page="upgrade">
                            <i class="fas fa-crown"></i> Become Artist
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.attachEventListeners();
        this.setActiveItem();
    }

    attachEventListeners() {
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                if (page && window.bravoApp) {
                    window.bravoApp.navigateTo(page);
                    this.setActiveItem(item);
                }
            });
        });
    }

    setActiveItem(activeItem = null) {
        const items = document.querySelectorAll('.sidebar-item');
        const currentHash = window.location.hash.slice(1);
        
        items.forEach(item => {
            if (activeItem) {
                if (item === activeItem) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            } else if (item.dataset.page === currentHash) {
                item.classList.add('active');
            } else if (currentHash.startsWith('admin') && item.dataset.page === 'admin/dashboard') {
                item.classList.add('active');
            } else if (currentHash === 'albums' && item.dataset.page === 'albums') {
                item.classList.add('active');
            } else if (currentHash === 'playlists' && item.dataset.page === 'playlists') {
                item.classList.add('active');
            } else if (currentHash.startsWith('artist') && item.dataset.page === 'dashboard') {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

window.Sidebar = Sidebar;