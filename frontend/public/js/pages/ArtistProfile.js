/**
 * Artist Profile Page
 */

class ArtistProfile {
    constructor(artistId) {
        this.artistId = artistId;
        this.artist = null;
        this.songs = [];
    }

    async render() {
        await this.loadArtistData();
        
        if (!this.artist) {
            return '<div class="error">Artist not found</div>';
        }
        
        return `
            <div class="artist-profile-container">
                <div class="artist-header">
                    <div class="artist-info">
                        <h1>${this.escapeHtml(this.artist.stageName)}</h1>
                        ${this.artist.verified ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified Artist</span>' : ''}
                        <div class="artist-stats">
                            <span><i class="fas fa-headphones"></i> ${this.formatNumber(this.artist.monthlyListeners || 0)} monthly listeners</span>
                            <span><i class="fas fa-music"></i> ${this.songs.length} songs</span>
                        </div>
                    </div>
                </div>
                
                <div class="artist-content">
                    <div class="artist-bio">
                        <h2>About</h2>
                        <p>${this.artist.bio || 'No bio available'}</p>
                    </div>
                    
                    <div class="artist-music">
                        <h2>Popular Songs</h2>
                        <div class="songs-grid" id="artist-songs-grid"></div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadArtistData() {
        try {
            const artistsAPI = new ArtistsAPI();
            this.artist = await artistsAPI.getById(this.artistId);
            
            if (this.artist && window.bravoApp && window.bravoApp.songs) {
                this.songs = window.bravoApp.songs.filter(s => s.artist?._id === this.artistId || s.artist === this.artistId);
            }
        } catch (error) {
            console.error('Load artist error:', error);
            this.artist = null;
        }
    }

    async afterRender() {
        const grid = document.getElementById('artist-songs-grid');
        if (grid && window.bravoApp) {
            grid.innerHTML = '';
            this.songs.forEach(song => {
                const card = window.bravoApp.createSongCard(song);
                grid.appendChild(card);
            });
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
}

window.ArtistProfile = ArtistProfile;