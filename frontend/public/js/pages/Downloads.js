/**
 * Downloads Page
 */

class DownloadsPage {
    constructor() {
        this.downloads = [];
    }

    async render() {
        this.loadDownloads();
        
        return `
            <div class="downloads-page">
                <div class="page-header">
                    <h1>My Downloads</h1>
                    <p>Songs you've downloaded for offline listening</p>
                </div>
                
                <div class="downloads-stats-bar">
                    <div class="stats-info">
                        <span><i class="fas fa-download"></i> ${this.downloads.length} songs downloaded</span>
                        <span><i class="fas fa-database"></i> Storage: ${this.calculateStorageUsed()}</span>
                    </div>
                    ${this.downloads.length > 0 ? `
                        <button class="btn-danger btn-sm" id="clear-all-downloads">
                            <i class="fas fa-trash"></i> Clear All
                        </button>
                    ` : ''}
                </div>
                
                <div id="downloads-list-container">
                    ${this.renderDownloadsList()}
                </div>
            </div>
        `;
    }

    loadDownloads() {
        const stored = localStorage.getItem('bravo_downloaded_songs');
        this.downloads = stored ? JSON.parse(stored) : [];
    }

    renderDownloadsList() {
        if (this.downloads.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-download"></i>
                    <h3>No Downloads Yet</h3>
                    <p>Download songs to listen offline</p>
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('browse')">
                        Browse Music
                    </button>
                </div>
            `;
        }

        return `
            <div class="downloads-grid">
                ${this.downloads.map(download => `
                    <div class="download-card" data-id="${download._id}">
                        <img src="${download.coverArt}" alt="${this.escapeHtml(download.title)}" class="download-card-cover">
                        <div class="download-card-info">
                            <h4>${this.escapeHtml(download.title)}</h4>
                            <p>${download.artist?.stageName || 'Unknown Artist'}</p>
                            <span class="download-date"><i class="far fa-calendar-alt"></i> ${this.formatDate(download.downloadedAt)}</span>
                        </div>
                        <div class="download-card-actions">
                            <button class="btn-icon play-download" data-id="${download._id}" title="Play">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn-icon delete-download" data-id="${download._id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    calculateStorageUsed() {
        const totalMB = this.downloads.length * 5;
        if (totalMB >= 1024) {
            return `${(totalMB / 1024).toFixed(1)} GB`;
        }
        return `${totalMB} MB`;
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        const clearAllBtn = document.getElementById('clear-all-downloads');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllDownloads());
        }
        
        document.querySelectorAll('.play-download').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const download = this.downloads.find(d => d._id === id);
                if (download && window.bravoApp?.songs) {
                    const song = window.bravoApp.songs.find(s => s._id === id);
                    if (song && window.bravoApp.audioPlayer) {
                        window.bravoApp.audioPlayer.loadSong(song);
                    }
                }
            });
        });
        
        document.querySelectorAll('.delete-download').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.deleteDownload(id);
            });
        });
    }

    deleteDownload(songId) {
        Modal.confirm('Remove this download?', () => {
            this.downloads = this.downloads.filter(d => d._id !== songId);
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(this.downloads));
            this.render();
            this.afterRender();
            Toast.show('Download removed', 'info');
        });
    }

    clearAllDownloads() {
        Modal.confirm('Delete all downloaded songs?', () => {
            this.downloads = [];
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(this.downloads));
            this.render();
            this.afterRender();
            Toast.show('All downloads cleared', 'info');
        });
    }

    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.DownloadsPage = DownloadsPage;