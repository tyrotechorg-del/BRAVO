/**
 * Navbar Component
 */

class Navbar {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.apiUrl = window.API_BASE_URL;
        this.render();
    }

    render() {
        if (!this.container) return;
        
        const auth = new AuthAPI();
        const isAuthenticated = auth.isAuthenticated();
        const user = auth.getUser();
        
        this.container.innerHTML = `
            <nav class="navbar">
                <div class="logo" onclick="window.bravoApp.navigateTo('home')">
                    <i class="fas fa-music"></i>
                    <span>Bravo Music</span>
                </div>
                
                <div class="nav-search">
                    <input type="text" id="global-search" placeholder="Search songs, artists...">
                    <button id="global-search-btn"><i class="fas fa-search"></i></button>
                </div>
                
                <div class="nav-menu">
                    ${isAuthenticated ? `
                        <div class="dropdown">
                            <button class="nav-link user-menu">
                                <img src="${user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'}" class="user-avatar">
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
                                <div class="dropdown-divider"></div>
                                <div class="dropdown-item" id="logout-btn">
                                    <i class="fas fa-sign-out-alt"></i> Logout
                                </div>
                            </div>
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
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        const searchBtn = document.getElementById('global-search-btn');
        const searchInput = document.getElementById('global-search');
        const logoutBtn = document.getElementById('logout-btn');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const auth = new AuthAPI();
                await auth.logout();
                window.location.reload();
            });
        }
        
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                document.querySelector('.nav-menu').classList.toggle('active');
            });
        }
        
        document.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', () => {
                const page = el.dataset.page;
                if (page && window.bravoApp) {
                    window.bravoApp.navigateTo(page);
                }
            });
        });
    }

    handleSearch() {
        if (window.bravoApp) {
            window.bravoApp.search();
        }
    }
}

window.Navbar = Navbar;