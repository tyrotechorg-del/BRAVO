// Toast Notification
class Toast {
    static show(message, type = 'info', duration = 4000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Modal
class Modal {
    static show(options) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${options.title || 'Modal'}</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">${options.content || ''}</div>
                ${options.buttons ? `
                    <div class="modal-footer">
                        ${options.buttons.map(btn => `
                            <button class="${btn.class}" data-action="${btn.action}">${btn.text}</button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        
        if (options.buttons) {
            options.buttons.forEach(btn => {
                const btnEl = modal.querySelector(`[data-action="${btn.action}"]`);
                if (btnEl && btn.onClick) btnEl.addEventListener('click', () => { btn.onClick(); modal.remove(); });
            });
        }
        return modal;
    }
    
    static confirm(message, onConfirm, onCancel = null) {
        return this.show({
            title: 'Confirm',
            content: `<p>${message}</p>`,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel', onClick: onCancel },
                { text: 'Confirm', class: 'btn-primary', action: 'confirm', onClick: onConfirm }
            ]
        });
    }
}

// Create Song Card
function createSongCard(song, onPlay) {
    const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
    const isLiked = likedSongs.includes(song._id);
    const coverUrl = API.getFullUrl(song.coverArt);
    
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
        <img src="${coverUrl}" alt="${escapeHtml(song.title)}" onerror="this.src='https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200'">
        <div class="song-card-overlay">
            <button class="play-btn"><i class="fas fa-play"></i></button>
            <button class="like-btn ${isLiked ? 'liked' : ''}"><i class="fas fa-heart"></i></button>
        </div>
        <div class="song-card-info">
            <h4 class="song-title">${escapeHtml(song.title)}</h4>
            <p class="song-artist">${song.artist?.stageName || 'Unknown Artist'}</p>
            <div class="song-stats">
                <span><i class="fas fa-play"></i> ${formatNumber(song.playCount || 0)}</span>
            </div>
        </div>
    `;
    
    card.querySelector('.play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (onPlay) onPlay(song);
    });
    
    card.querySelector('.like-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!API.getToken()) {
            Toast.show('Please login to like songs', 'info');
            window.location.href = 'login.html';
            return;
        }
        if (isLiked) {
            await SongsAPI.unlike(song._id);
            const newLiked = likedSongs.filter(id => id !== song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
            card.querySelector('.like-btn').classList.remove('liked');
            Toast.show('Removed from liked songs', 'info');
        } else {
            await SongsAPI.like(song._id);
            likedSongs.push(song._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
            card.querySelector('.like-btn').classList.add('liked');
            Toast.show('Added to liked songs! ❤️', 'success');
        }
    });
    
    return card;
}

// Create Artist Card
function createArtistCard(artist) {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.innerHTML = `
        <img src="${API.getFullUrl(artist.avatar) || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'}" alt="${escapeHtml(artist.stageName)}">
        <h4>${escapeHtml(artist.stageName)}${artist.verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}</h4>
        <p>${formatNumber(artist.monthlyListeners || 0)} monthly listeners</p>
    `;
    card.addEventListener('click', () => {
        window.location.href = `artist.html?id=${artist._id}`;
    });
    return card;
}

// Helper Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Load Home Page Data
async function loadHomePage() {
    try {
        const [featured, trending, topArtists] = await Promise.all([
            SongsAPI.getFeatured(),
            SongsAPI.getTrending(),
            SongsAPI.getTopArtists()
        ]);
        
        const featuredGrid = document.getElementById('featured-grid');
        const trendingGrid = document.getElementById('trending-grid');
        const artistsGrid = document.getElementById('artists-grid');
        
        if (featuredGrid && featured) {
            featuredGrid.innerHTML = '';
            (featured.data || featured).slice(0, 8).forEach(song => {
                featuredGrid.appendChild(createSongCard(song, (s) => {
                    Toast.show(`Now playing: ${s.title}`, 'success');
                }));
            });
        }
        
        if (trendingGrid && trending) {
            trendingGrid.innerHTML = '';
            (trending.data || trending).slice(0, 8).forEach(song => {
                trendingGrid.appendChild(createSongCard(song, (s) => {
                    Toast.show(`Now playing: ${s.title}`, 'success');
                }));
            });
        }
        
        if (artistsGrid && topArtists) {
            artistsGrid.innerHTML = '';
            (topArtists.data || topArtists).slice(0, 6).forEach(artist => {
                artistsGrid.appendChild(createArtistCard(artist));
            });
        }
    } catch (error) {
        console.error('Load home page error:', error);
        Toast.show('Failed to load content', 'error');
    }
}

// Initialize Navbar
function initNavbar() {
    const user = API.getUser();
    const isAuth = API.isAuthenticated();
    const dropdownBtn = document.querySelector('.dropdown-btn');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (dropdownBtn && isAuth && user) {
        const img = dropdownBtn.querySelector('img');
        const span = dropdownBtn.querySelector('span');
        if (img) img.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32';
        if (span) span.textContent = user.username || 'User';
        
        if (dropdownMenu) {
            dropdownMenu.innerHTML = `
                ${user.role === 'artist' ? '<a href="artist-dashboard.html"><i class="fas fa-chart-line"></i> Dashboard</a>' : ''}
                ${user.role === 'admin' ? '<a href="admin-dashboard.html"><i class="fas fa-shield-alt"></i> Admin Panel</a>' : ''}
                <a href="settings.html"><i class="fas fa-cog"></i> Settings</a>
                <hr>
                <a href="#" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a>
            `;
            
            document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
                e.preventDefault();
                await AuthAPI.logout();
                window.location.href = 'index.html';
            });
        }
    }
    
    // Mobile menu toggle
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (mobileBtn && navLinks) {
        mobileBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
        loadHomePage();
    }
});

window.Toast = Toast;
window.Modal = Modal;
window.createSongCard = createSongCard;
window.createArtistCard = createArtistCard;
window.loadHomePage = loadHomePage;