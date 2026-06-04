/**
 * Bravo Music Platform - Main Application
 */

class BravoMusicApp {
    constructor() {
        this.currentPage = 'home';
        this.songs = [];
        this.albums = [];
        this.artists = [];
        this.audioPlayer = null;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.socket = null;
        this.notificationCount = 0;
        this.searchDebounceTimer = null;
        this.init();
    }

    async init() {
        console.log('🎵 Bravo Music App Initializing...');
        
        this.showLoading();
        await this.checkAuth();
        await this.loadInitialData();
        
        this.audioPlayer = new AudioPlayer('#audio-player-container');
        this.renderNavbar();
        this.renderSidebar();
        
        this.setupNavigation();
        this.setupSocketConnection();
        this.setupEventListeners();
        
        await this.loadPage(this.getPageFromHash());
        
        this.checkEmailVerificationMessage();
        
        Toast.show('Welcome to Bravo Music! 🎵', 'success');
    }

    showLoading() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading Bravo Music...</p></div>';
        }
    }

    async checkAuth() {
        const auth = new AuthAPI();
        this.currentUser = auth.getUser();
        this.isAuthenticated = auth.isAuthenticated();
        
        if (this.isAuthenticated && !this.currentUser) {
            const userAPI = new UserAPI();
            const profile = await userAPI.getProfile();
            if (profile && profile.user) {
                this.currentUser = profile.user;
                auth.setUser(this.currentUser);
            }
        }
        
        if (this.isAuthenticated && this.currentUser && !this.currentUser.isVerified) {
            setTimeout(() => {
                Toast.show('Please verify your email to access all features. Check your inbox!', 'warning', 8000);
            }, 2000);
        }
        
        console.log('👤 Authenticated:', this.isAuthenticated);
        if (this.currentUser) {
            console.log('📧 User:', this.currentUser.email, 'Role:', this.currentUser.role, 'Verified:', this.currentUser.isVerified);
        }
    }

    checkEmailVerificationMessage() {
        const urlParams = new URLSearchParams(window.location.search);
        const verified = urlParams.get('verified');
        if (verified === 'true') {
            Toast.show('Email verified successfully! You can now login.', 'success');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    setupSocketConnection() {
        if (this.isAuthenticated && window.SocketService) {
            this.socket = new SocketService();
            this.socket.connect(localStorage.getItem('bravo_token'));
            this.setupSocketListeners();
            console.log('🔌 Socket.io connected');
        }
    }

    setupSocketListeners() {
        if (!this.socket) return;
        
        this.socket.on('notification', (notification) => {
            this.showNotificationToast(notification);
            this.updateNotificationBadge();
        });
        
        this.socket.on('comment-added', (comment) => {
            const currentPage = this.getPageFromHash();
            if (currentPage.startsWith('song/')) {
                this.addCommentToCurrentSong(comment);
            }
        });
        
        this.socket.on('listener-count', (data) => {
            const listenerEl = document.getElementById('live-listeners');
            if (listenerEl) {
                listenerEl.innerHTML = `<i class="fas fa-headphones"></i> ${data.count} listening now`;
            }
        });
        
        this.socket.on('song-liked', (data) => {
            if (data.songId && window.location.hash.includes(`song/${data.songId}`)) {
                this.updateLikeButton(data.liked);
            }
        });
        
        this.socket.on('user-typing', (data) => {
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) {
                if (data.isTyping) {
                    typingIndicator.textContent = `${data.username} is typing...`;
                    typingIndicator.style.display = 'block';
                    setTimeout(() => {
                        typingIndicator.style.display = 'none';
                    }, 2000);
                } else {
                    typingIndicator.style.display = 'none';
                }
            }
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Socket connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });
    }

    showNotificationToast(notification) {
        const icon = this.getNotificationIcon(notification.type);
        Toast.show(`${icon} ${notification.title}: ${notification.message}`, 'info', 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            like: '❤️',
            comment: '💬',
            follow: '👤',
            subscription: '👑',
            withdrawal: '💰',
            admin: '🛡️',
            welcome: '🎉',
            artist_update: '🎵'
        };
        return icons[type] || '🔔';
    }

    async updateNotificationBadge() {
        if (!this.isAuthenticated) return;
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/notifications/unread-count`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('bravo_token')}` }
            });
            const data = await response.json();
            this.notificationCount = data.count || 0;
            
            const badge = document.getElementById('notification-badge');
            if (badge) {
                if (this.notificationCount > 0) {
                    badge.style.display = 'flex';
                    badge.textContent = this.notificationCount > 99 ? '99+' : this.notificationCount;
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Failed to fetch notification count:', error);
        }
    }

    addCommentToCurrentSong(comment) {
        const commentsContainer = document.getElementById('song-comments-container');
        if (commentsContainer) {
            const commentHtml = this.createCommentHtml(comment);
            commentsContainer.insertAdjacentHTML('afterbegin', commentHtml);
        }
    }

    createCommentHtml(comment) {
        return `
            <div class="comment-item" data-comment-id="${comment._id}">
                <div class="comment-avatar">
                    <img src="${comment.user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'}" alt="${comment.user?.username}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${this.escapeHtml(comment.user?.username || 'Anonymous')}</span>
                        <span class="comment-time">Just now</span>
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.content)}</div>
                </div>
            </div>
        `;
    }

    updateLikeButton(liked) {
        const likeBtn = document.getElementById('like-song-btn');
        if (likeBtn) {
            if (liked) {
                likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
                likeBtn.classList.add('liked');
            } else {
                likeBtn.innerHTML = '<i class="fas fa-heart"></i> Like';
                likeBtn.classList.remove('liked');
            }
        }
    }

    async loadInitialData() {
        try {
            const songsAPI = new SongsAPI();
            const songsResult = await songsAPI.getAll(1, 100);
            this.songs = songsResult.songs || [];
            console.log(`📀 Loaded ${this.songs.length} songs from backend`);
            
            const albumsAPI = new AlbumsAPI();
            const albumsResult = await albumsAPI.getAll(1, 50);
            this.albums = albumsResult.albums || [];
            console.log(`💿 Loaded ${this.albums.length} albums`);
            
            if (this.isAuthenticated && this.currentUser?.role === 'artist') {
                const artistsAPI = new ArtistsAPI();
                const artistData = await artistsAPI.getDashboard();
                if (artistData && artistData.artist) {
                    this.currentArtist = artistData.artist;
                }
            }
            
            if (this.songs.length > 0) {
                console.log('Sample song:', this.songs[0].title, 'by', this.songs[0].artist?.stageName);
            }
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.songs = [];
            this.albums = [];
        }
    }

    renderNavbar() {
        const container = document.getElementById('navbar-container');
        if (!container) return;
        
        const auth = new AuthAPI();
        const isAuth = auth.isAuthenticated();
        const user = auth.getUser();
        const isVerified = user?.isVerified !== false;
        
        container.innerHTML = `
            <nav class="navbar">
                <div class="logo" onclick="window.bravoApp.navigateTo('home')">
                    <img src="${window.getDefaultImage()}" alt="Bravo Music" class="logo-img">
                    <span>Bravo Music</span>
                </div>
                
                <div class="nav-search">
                    <input type="text" id="global-search" placeholder="Search songs, artists, genres...">
                    <button id="global-search-btn"><i class="fas fa-search"></i></button>
                </div>
                
                <div class="nav-menu" id="nav-menu">
                    ${isAuth ? `
                        <div class="dropdown">
                            <button class="nav-link user-menu">
                                <img src="${user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'}" class="user-avatar" onerror="this.src='${window.getDefaultImage()}'">
                                <span>${user?.username || 'User'}</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="dropdown-menu">
                                <div class="dropdown-item" data-page="dashboard">
                                    <i class="fas fa-tachometer-alt"></i> Dashboard
                                </div>
                                <div class="dropdown-item" data-page="settings">
                                    <i class="fas fa-cog"></i> Settings
                                </div>
                                ${!isVerified ? `
                                    <div class="dropdown-item" id="resend-verification-btn">
                                        <i class="fas fa-envelope"></i> Resend Verification
                                    </div>
                                ` : ''}
                                <div class="dropdown-divider"></div>
                                <div class="dropdown-item" id="logout-btn">
                                    <i class="fas fa-sign-out-alt"></i> Logout
                                </div>
                            </div>
                        </div>
                        <div class="notification-icon" id="notification-icon">
                            <i class="fas fa-bell"></i>
                            <span class="notification-badge" id="notification-badge" style="display: none;">0</span>
                        </div>
                    ` : `
                        <button class="nav-link" data-page="login">Login</button>
                        <button class="btn-primary" data-page="register">Sign Up</button>
                    `}
                </div>
                
                <button class="mobile-menu-btn" id="mobile-menu-btn">
                    <i class="fas fa-bars"></i>
                </button>
            </nav>
        `;
        
        this.attachNavbarEvents();
    }

    attachNavbarEvents() {
        const searchInput = document.getElementById('global-search');
        const searchBtn = document.getElementById('global-search-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const notificationIcon = document.getElementById('notification-icon');
        const resendVerificationBtn = document.getElementById('resend-verification-btn');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.search());
        }
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = setTimeout(() => {
                    this.realTimeSearch();
                }, 300);
            });
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.search();
                }
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const auth = new AuthAPI();
                await auth.logout();
                if (this.socket) this.socket.disconnect();
                window.location.reload();
            });
        }
        
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                document.querySelector('.nav-menu')?.classList.toggle('active');
            });
        }
        
        if (notificationIcon) {
            notificationIcon.addEventListener('click', () => {
                window.location.hash = 'notifications';
            });
        }
        
        if (resendVerificationBtn) {
            resendVerificationBtn.addEventListener('click', async () => {
                const user = new AuthAPI().getUser();
                if (user && user.email) {
                    const authService = new AuthService();
                    const result = await authService.resendVerification(user.email);
                    if (result.success) {
                        Toast.show('Verification email sent! Check your inbox.', 'success');
                    } else {
                        Toast.show(result.error || 'Failed to send verification', 'error');
                    }
                }
            });
        }
        
        document.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', () => {
                const page = el.dataset.page;
                if (page) this.navigateTo(page);
            });
        });
    }

    renderSidebar() {
        const container = document.getElementById('sidebar-container');
        if (!container) return;
        
        const auth = new AuthAPI();
        const user = auth.getUser();
        const role = user?.role || 'listener';
        
        container.innerHTML = `
            <div class="sidebar">
                <div class="sidebar-section">
                    <h3>MAIN</h3>
                    <ul class="sidebar-nav">
                        <li class="sidebar-item" data-page="home"><i class="fas fa-home"></i> Home</li>
                        <li class="sidebar-item" data-page="browse"><i class="fas fa-compass"></i> Browse</li>
                        <li class="sidebar-item" data-page="trending"><i class="fas fa-fire"></i> Trending</li>
                        <li class="sidebar-item" data-page="videos"><i class="fas fa-video"></i> Videos</li>
                    </ul>
                </div>
                
                <div class="sidebar-section">
                    <h3>YOUR LIBRARY</h3>
                    <ul class="sidebar-nav">
                        <li class="sidebar-item" data-page="liked"><i class="fas fa-heart"></i> Liked Songs</li>
                        <li class="sidebar-item" data-page="recent"><i class="fas fa-history"></i> Recently Played</li>
                        <li class="sidebar-item" data-page="downloads"><i class="fas fa-download"></i> Downloads</li>
                        <li class="sidebar-item" data-page="playlists"><i class="fas fa-list"></i> Playlists</li>
                        <li class="sidebar-item" data-page="albums"><i class="fas fa-album"></i> Albums</li>
                    </ul>
                </div>
                
                ${role === 'artist' ? `
                    <div class="sidebar-section">
                        <h3>ARTIST HUB</h3>
                        <ul class="sidebar-nav">
                            <li class="sidebar-item" data-page="dashboard"><i class="fas fa-chart-line"></i> Dashboard</li>
                            <li class="sidebar-item" data-page="upload"><i class="fas fa-upload"></i> Upload</li>
                            <li class="sidebar-item" data-page="earnings"><i class="fas fa-wallet"></i> Earnings</li>
                            <li class="sidebar-item" data-page="artist/albums"><i class="fas fa-album"></i> My Albums</li>
                            <li class="sidebar-item" data-page="artist/videos"><i class="fas fa-video"></i> My Videos</li>
                        </ul>
                    </div>
                ` : ''}
                
                ${role === 'admin' ? `
                    <div class="sidebar-section">
                        <h3>ADMIN PANEL</h3>
                        <ul class="sidebar-nav">
                            <li class="sidebar-item" data-page="admin/dashboard"><i class="fas fa-chart-bar"></i> Overview</li>
                            <li class="sidebar-item" data-page="admin/all-songs"><i class="fas fa-headphones"></i> All Songs</li>
                            <li class="sidebar-item" data-page="admin/pending"><i class="fas fa-clock"></i> Pending Songs</li>
                            <li class="sidebar-item" data-page="admin/videos"><i class="fas fa-video"></i> Videos</li>
                            <li class="sidebar-item" data-page="admin/albums"><i class="fas fa-album"></i> Albums</li>
                            <li class="sidebar-item" data-page="admin/users"><i class="fas fa-users"></i> Users</li>
                            <li class="sidebar-item" data-page="admin/artists"><i class="fas fa-user-musician"></i> Artists</li>
                            <li class="sidebar-item" data-page="admin/withdrawals"><i class="fas fa-money-bill-wave"></i> Withdrawals</li>
                            <li class="sidebar-item" data-page="admin/reports"><i class="fas fa-flag"></i> Reports</li>
                            <li class="sidebar-item" data-page="admin/comments"><i class="fas fa-comment"></i> Reported Comments</li>
                            <li class="sidebar-item" data-page="admin/settings"><i class="fas fa-cog"></i> Settings</li>
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
        
        document.querySelectorAll('.sidebar-item').forEach(el => {
            el.addEventListener('click', () => {
                const page = el.dataset.page;
                if (page) this.navigateTo(page);
            });
        });
    }

    setupNavigation() {
        window.addEventListener('hashchange', () => {
            this.loadPage(this.getPageFromHash());
        });
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            // Get the currently focused element
            const activeElement = document.activeElement;
            
            // Comprehensive check for typing contexts
            const isTyping = activeElement && (
                // Form elements
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.tagName === 'SELECT' ||
                // Content editable divs
                activeElement.isContentEditable ||
                // Rich text editors
                activeElement.closest('[contenteditable="true"]') ||
                // Input types that accept text
                (activeElement.tagName === 'INPUT' && (
                    activeElement.type === 'text' ||
                    activeElement.type === 'email' ||
                    activeElement.type === 'password' ||
                    activeElement.type === 'search' ||
                    activeElement.type === 'tel' ||
                    activeElement.type === 'url' ||
                    activeElement.type === 'number'
                ))
            );
            
            // Space bar (key code 32)
            if (e.code === 'Space' || e.keyCode === 32) {
                if (!isTyping) {
                    e.preventDefault();
                    if (this.audioPlayer) {
                        this.audioPlayer.togglePlay();
                    }
                }
                // If typing, allow normal space input
                return;
            }
            
            // Arrow keys for media control (only when not typing)
            if (!isTyping) {
                // Right Arrow - Next song
                if (e.code === 'ArrowRight' || e.keyCode === 39) {
                    e.preventDefault();
                    if (this.audioPlayer && this.audioPlayer.playNext) {
                        this.audioPlayer.playNext();
                    }
                    return;
                }
                
                // Left Arrow - Previous song
                if (e.code === 'ArrowLeft' || e.keyCode === 37) {
                    e.preventDefault();
                    if (this.audioPlayer && this.audioPlayer.playPrevious) {
                        this.audioPlayer.playPrevious();
                    }
                    return;
                }
                
                // Up Arrow - Volume up
                if (e.code === 'ArrowUp' || e.keyCode === 38) {
                    e.preventDefault();
                    if (this.audioPlayer && this.audioPlayer.increaseVolume) {
                        this.audioPlayer.increaseVolume();
                    }
                    return;
                }
                
                // Down Arrow - Volume down
                if (e.code === 'ArrowDown' || e.keyCode === 40) {
                    e.preventDefault();
                    if (this.audioPlayer && this.audioPlayer.decreaseVolume) {
                        this.audioPlayer.decreaseVolume();
                    }
                    return;
                }
            }
        });
    }

    getPageFromHash() {
        let hash = window.location.hash.slice(1);
        // Decode the hash to handle special characters
        hash = decodeURIComponent(hash);
        console.log('Page from hash:', hash);
        return hash || 'home';
    }

    async loadPage(page) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        
        mainContent.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';
        
        // Handle email verification route
        if (page.startsWith('verify-email/')) {
            const token = page.split('/')[1];
            const verifyPage = new VerifyEmailPage(token);
            const content = await verifyPage.render();
            mainContent.innerHTML = content;
            if (verifyPage.afterRender) await verifyPage.afterRender();
            return;
        }
        
        // Handle forgot password route
        if (page === 'forgot-password') {
            console.log('Loading forgot password page...');
            const forgotPasswordPage = new ForgotPasswordPage();
            const content = await forgotPasswordPage.render();
            mainContent.innerHTML = content;
            if (forgotPasswordPage.afterRender) await forgotPasswordPage.afterRender();
            return;
        }
        

        // Handle reset password route
    if (page.indexOf('reset-password') !== -1) {
        console.log('🔄 Reset password route detected, page:', page);
        
        // Extract token - get everything after 'reset-password/'
        let token = '';
        if (page.includes('reset-password/')) {
            token = page.split('reset-password/')[1];
        } else if (page.includes('reset-password')) {
            token = page.replace('reset-password', '').replace('/', '');
        }
        
        // Clean up token (remove any leading slashes or hash)
        token = token.replace(/^\/+/, '').replace(/#.*$/, '');
        
        console.log('📝 Extracted token:', token);
        
        if (!token || token.length < 10) {
            console.error('❌ Invalid reset token');
            mainContent.innerHTML = `
                <div class="form-container animate-fade-in-up">
                    <div class="error-icon" style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-exclamation-circle" style="font-size: 64px; color: #ff4757;"></i>
                    </div>
                    <h2 style="text-align: center;">Invalid Reset Link</h2>
                    <p style="text-align: center;">The password reset link is invalid or has expired.</p>
                    <div class="form-actions" style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
                        <button class="btn-primary" onclick="window.bravoApp.navigateTo('forgot-password')">Request New Link</button>
                        <button class="btn-outline" onclick="window.bravoApp.navigateTo('login')">Back to Login</button>
                    </div>
                </div>
            `;
            return;
        }
        
        // Check if class exists
        if (typeof ResetPasswordPage === 'undefined') {
            console.error('❌ ResetPasswordPage class not defined!');
            mainContent.innerHTML = '<div class="error">Page not loaded. Please refresh.</div>';
            return;
        }
        
        const resetPasswordPage = new ResetPasswordPage(token);
        const content = resetPasswordPage.render();
        mainContent.innerHTML = content;
        if (resetPasswordPage.afterRender) {
            await resetPasswordPage.afterRender();
        }
        return;
    }
        
        // Handle admin routes
        if (page.startsWith('admin/')) {
            const auth = new AuthAPI();
            if (!auth.isAdmin()) {
                Toast.show('Admin access required', 'error');
                window.location.hash = 'home';
                return;
            }
            
            let adminPage = null;
            
            switch(page) {
                case 'admin/dashboard':
                    adminPage = new AdminDashboardPage();
                    break;
                case 'admin/songs':
                case 'admin/pending':
                    adminPage = new AdminSongsPage();
                    break;
                case 'admin/all-songs':
                    adminPage = new AdminAllSongsPage();
                    break;
                case 'admin/users':
                    adminPage = new AdminUsersPage();
                    break;
                case 'admin/artists':
                    adminPage = new AdminArtistsPage();
                    break;
                case 'admin/videos':
                    adminPage = new AdminVideosPage();
                    break;
                case 'admin/albums':
                    adminPage = new AdminAlbumsPage();
                    break;
                case 'admin/withdrawals':
                    adminPage = new AdminWithdrawalsPage();
                    break;
                case 'admin/reports':
                    adminPage = new AdminReportsPage();
                    break;
                case 'admin/comments':
                    adminPage = new AdminCommentsPage();
                    break;
                case 'admin/settings':
                    adminPage = new AdminSettingsPage();
                    break;
                default:
                    adminPage = new AdminDashboardPage();
            }
            
            if (adminPage) {
                const content = await adminPage.render();
                mainContent.innerHTML = content;
                if (adminPage.afterRender) await adminPage.afterRender();
            }
            return;
        }
        
        // Handle regular routes
        let pageInstance = null;
        
        switch(page) {
            case 'home':
                pageInstance = new HomePage();
                break;
            case 'browse':
                pageInstance = new BrowsePage();
                break;
            case 'trending':
                pageInstance = new TrendingPage();
                break;
            case 'videos':
                pageInstance = new VideosPage();
                break;
            case 'liked':
                pageInstance = new LikedPage();
                break;
            case 'recent':
                pageInstance = new RecentPage();
                break;
            case 'downloads':
                pageInstance = new DownloadsPage();
                break;
            case 'login':
                pageInstance = new LoginPage();
                break;
            case 'register':
                pageInstance = new RegisterPage();
                break;
            case 'dashboard':
                if (this.currentUser?.role === 'artist') {
                    pageInstance = new ArtistDashboardPage();
                } else {
                    pageInstance = new ListenerDashboardPage();
                }
                break;
            case 'earnings':
                pageInstance = new EarningsPage();
                break;
            case 'settings':
                pageInstance = new SettingsPage();
                break;
            case 'upload':
                pageInstance = new UploadPage();
                break;
            case 'albums':
                pageInstance = new AlbumsPage();
                break;
            case 'playlists':
                pageInstance = new PlaylistsPage();
                break;
            case 'notifications':
                pageInstance = new NotificationsPage();
                break;
            case 'subscriptions':
                pageInstance = new SubscriptionsPage();
                break;
            case 'upgrade':
                pageInstance = new UpgradePage();
                break;
            default:
                if (page.startsWith('song/')) {
                    const songId = page.split('/')[1];
                    pageInstance = new SongDetailPage(songId);
                } 
                else if (page.startsWith('artist/')) {
                    const artistId = page.split('/')[1];
                    pageInstance = new ArtistProfile(artistId);
                }
                else if (page.startsWith('album/')) {
                    const albumId = page.split('/')[1];
                    pageInstance = new AlbumView(albumId);
                }
                else if (page.startsWith('playlist/')) {
                    const playlistId = page.split('/')[1];
                    pageInstance = new PlaylistView(playlistId);
                }
                else {
                    pageInstance = new HomePage();
                }
        }
        
        if (pageInstance) {
            const content = await pageInstance.render();
            mainContent.innerHTML = content;
            if (pageInstance.afterRender) {
                await pageInstance.afterRender();
            }
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ============ SEARCH FUNCTIONS ============

    realTimeSearch() {
        const query = document.getElementById('global-search')?.value.trim();
        
        if (!query || query.length < 2) {
            this.clearSearchResults();
            return;
        }
        
        const results = this.fuzzySearch(query);
        this.displaySearchResults(results, query);
    }

    fuzzySearch(query) {
        const searchTerm = query.toLowerCase();
        
        const filtered = this.songs.filter(song => {
            const titleMatch = song.title?.toLowerCase().includes(searchTerm);
            const artistMatch = song.artist?.stageName?.toLowerCase().includes(searchTerm);
            const genreMatch = song.genre?.toLowerCase().includes(searchTerm);
            const tagsMatch = song.tags?.some(tag => tag.toLowerCase().includes(searchTerm));
            
            return titleMatch || artistMatch || genreMatch || tagsMatch;
        });
        
        filtered.sort((a, b) => {
            const aTitle = a.title?.toLowerCase().includes(searchTerm);
            const bTitle = b.title?.toLowerCase().includes(searchTerm);
            if (aTitle && !bTitle) return -1;
            if (!aTitle && bTitle) return 1;
            return 0;
        });
        
        return filtered;
    }

    displaySearchResults(results, query) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        
        const getFullUrl = (url) => {
            if (!url) return window.getDefaultImage();
            if (url.startsWith('http')) return url;
            if (url.startsWith('/uploads')) return `${window.APP_CONFIG.STATIC_URL}${url}`;
            return url;
        };
        
        if (results.length === 0) {
            mainContent.innerHTML = `
                <div class="search-container">
                    <div class="search-header">
                        <h1>Search Results</h1>
                        <div class="search-stats">
                            <input type="text" id="search-input-main" class="search-input-large" 
                                   placeholder="Search songs, artists, genres..." value="${this.escapeHtml(query)}">
                            <button id="search-main-btn" class="btn-primary">Search</button>
                        </div>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h3>No results found for "${this.escapeHtml(query)}"</h3>
                        <p>Try searching with different keywords</p>
                        <div class="suggestions">
                            <h4>Suggestions:</h4>
                            <div class="suggestion-chips">
                                <span class="suggestion-chip" onclick="window.bravoApp.searchWithTerm('afrobeat')">Afrobeat</span>
                                <span class="suggestion-chip" onclick="window.bravoApp.searchWithTerm('hip hop')">Hip Hop</span>
                                <span class="suggestion-chip" onclick="window.bravoApp.searchWithTerm('zambian')">Zambian</span>
                                <span class="suggestion-chip" onclick="window.bravoApp.searchWithTerm('cuundu')">Cuundu</span>
                                <span class="suggestion-chip" onclick="window.bravoApp.searchWithTerm('kalindula')">Kalindula</span>
                                <span class="suggestion-chip" onclick="window.bravoApp.searchWithTerm('gospel')">Gospel</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            mainContent.innerHTML = `
                <div class="search-container">
                    <div class="search-header">
                        <h1>Search Results</h1>
                        <div class="search-stats">
                            <input type="text" id="search-input-main" class="search-input-large" 
                                   placeholder="Search songs, artists, genres..." value="${this.escapeHtml(query)}">
                            <button id="search-main-btn" class="btn-primary">Search</button>
                        </div>
                        <p class="search-count">Found ${results.length} ${results.length === 1 ? 'song' : 'songs'}</p>
                    </div>
                    <div class="songs-grid" id="search-results-grid"></div>
                </div>
            `;
        }
        
        const searchInputMain = document.getElementById('search-input-main');
        const searchMainBtn = document.getElementById('search-main-btn');
        
        if (searchInputMain) {
            searchInputMain.addEventListener('input', (e) => {
                const newQuery = e.target.value.trim();
                if (newQuery.length >= 2) {
                    this.realTimeSearchWithQuery(newQuery);
                } else if (newQuery.length === 0) {
                    this.loadPage(this.getPageFromHash());
                }
            });
            searchInputMain.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchWithQuery(searchInputMain.value.trim());
                }
            });
        }
        
        if (searchMainBtn) {
            searchMainBtn.addEventListener('click', () => {
                this.searchWithQuery(searchInputMain?.value.trim() || query);
            });
        }
        
        if (results.length > 0) {
            const grid = document.getElementById('search-results-grid');
            if (grid) {
                results.forEach(song => {
                    const songWithUrls = {
                        ...song,
                        coverArt: getFullUrl(song.coverArt),
                        audioUrl: getFullUrl(song.audioUrl)
                    };
                    const card = this.createSongCard(songWithUrls);
                    grid.appendChild(card);
                });
            }
        }
    }

    realTimeSearchWithQuery(query) {
        if (!query || query.length < 2) {
            this.clearSearchResults();
            return;
        }
        
        const results = this.fuzzySearch(query);
        this.displaySearchResults(results, query);
    }

    searchWithQuery(query) {
        if (!query) return;
        
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = query;
        
        const results = this.fuzzySearch(query);
        this.displaySearchResults(results, query);
    }

    searchWithTerm(term) {
        const searchInput = document.getElementById('global-search');
        if (searchInput) searchInput.value = term;
        this.searchWithQuery(term);
    }

    clearSearchResults() {
        const mainContent = document.getElementById('main-content');
        if (mainContent && mainContent.innerHTML.includes('search-container')) {
            this.loadPage(this.getPageFromHash());
        }
    }

    async search() {
        const query = document.getElementById('global-search')?.value.trim();
        if (!query) return;
        
        const results = this.fuzzySearch(query);
        this.displaySearchResults(results, query);
    }

    // ============ SONG CARD CREATION ============

    createSongCard(song) {
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(song._id);
        const isDownloaded = this.isSongDownloaded(song._id);
        
        const card = document.createElement('div');
        card.className = 'song-card';
        card.setAttribute('data-song-id', song._id);
        card.innerHTML = `
            <img src="${song.coverArt}" alt="${this.escapeHtml(song.title)}" onerror="this.src='${window.getDefaultImage()}'">
            <div class="song-card-overlay">
                <button class="play-btn" title="Play"><i class="fas fa-play"></i></button>
                <button class="like-btn ${isLiked ? 'liked' : ''}" title="Like"><i class="fas fa-heart"></i></button>
                <button class="download-btn ${isDownloaded ? 'downloaded' : ''}" title="${isDownloaded ? 'Downloaded' : 'Download'}">
                    <i class="fas fa-download"></i>
                </button>
                <button class="share-btn" title="Share"><i class="fas fa-share-alt"></i></button>
            </div>
            <div class="song-card-info">
                <h4 class="song-title">${this.escapeHtml(song.title)}</h4>
                <p class="song-artist">${song.artist?.stageName || 'Unknown Artist'}</p>
                <div class="song-stats">
                    <span><i class="fas fa-play"></i> ${this.formatNumber(song.playCount || 0)}</span>
                    ${isDownloaded ? '<span class="downloaded-badge"><i class="fas fa-check"></i> Downloaded</span>' : ''}
                </div>
            </div>
        `;
        
        const playBtn = card.querySelector('.play-btn');
        const likeBtn = card.querySelector('.like-btn');
        const downloadBtn = card.querySelector('.download-btn');
        const shareBtn = card.querySelector('.share-btn');
        
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.audioPlayer) {
                    this.audioPlayer.loadSong(song);
                }
            });
        }
        
        if (likeBtn) {
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const songsAPI = new SongsAPI();
                if (isLiked) {
                    await songsAPI.unlike(song._id);
                    const newLiked = likedSongs.filter(id => id !== song._id);
                    localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
                    likeBtn.classList.remove('liked');
                    Toast.show('Removed from liked songs', 'info');
                    
                    if (this.socket) {
                        this.socket.emit('unlike-song', { songId: song._id });
                    }
                } else {
                    await songsAPI.like(song._id);
                    likedSongs.push(song._id);
                    localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
                    likeBtn.classList.add('liked');
                    Toast.show('Added to liked songs! ❤️', 'success');
                    
                    if (this.socket && song.artist?.userId) {
                        this.socket.emit('like-song', { 
                            songId: song._id, 
                            ownerId: song.artist?.userId 
                        });
                    }
                }
            });
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.downloadSong(song);
                downloadBtn.classList.add('downloaded');
                downloadBtn.title = 'Downloaded';
            });
        }
        
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                ShareModal.show(song);
            });
        }
        
        card.addEventListener('click', () => {
            if (this.audioPlayer) {
                this.audioPlayer.loadSong(song);
            }
        });
        
        return card;
    }

    // ============ DOWNLOAD FUNCTIONS ============

    isSongDownloaded(songId) {
        const downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
        return downloads.some(d => d._id === songId);
    }

    async downloadSong(song) {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            Toast.show('Please login to download', 'info');
            window.location.hash = 'login';
            return;
        }
        
        Toast.show(`Downloading "${song.title}"...`, 'info');
        
        try {
            let audioUrl = song.audioUrl;
            if (audioUrl && !audioUrl.startsWith('http') && audioUrl.startsWith('/uploads')) {
                audioUrl = `${window.APP_CONFIG.STATIC_URL}${audioUrl}`;
            }
            
            const response = await fetch(audioUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${song.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.saveToDownloads(song);
            Toast.show(`Downloaded "${song.title}" successfully! 📥`, 'success');
            
            if (this.socket) {
                this.socket.emit('track-download', { songId: song._id });
            }
        } catch (error) {
            console.error('Download failed:', error);
            Toast.show('Download failed. Please try again.', 'error');
        }
    }

    saveToDownloads(song) {
        let downloads = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
        
        if (!downloads.some(d => d._id === song._id)) {
            downloads.unshift({
                _id: song._id,
                title: song.title,
                artist: song.artist,
                coverArt: song.coverArt,
                downloadedAt: new Date().toISOString(),
                duration: song.duration
            });
            downloads = downloads.slice(0, 50);
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(downloads));
        }
    }

    // ============ UTILITY FUNCTIONS ============

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

    navigateTo(page) {
        console.log('Navigating to:', page);
        window.location.hash = page;
    }

    playNext() {
        if (this.audioPlayer) {
            this.audioPlayer.playNext();
        }
    }

    playPrevious() {
        if (this.audioPlayer) {
            this.audioPlayer.playPrevious();
        }
    }
}

// Start the app
let bravoApp = null;
document.addEventListener('DOMContentLoaded', () => {
    bravoApp = new BravoMusicApp();
    window.bravoApp = bravoApp;
});s