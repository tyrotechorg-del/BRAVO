/**
 * Download Manager Component
 */

class DownloadManager {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.downloads = [];
        this.init();
    }

    init() {
        this.loadDownloads();
        this.render();
    }

    loadDownloads() {
        const stored = localStorage.getItem('bravo_downloaded_songs');
        if (stored) {
            this.downloads = JSON.parse(stored);
        }
    }

    render() {
        if (!this.container) return;
        
        if (this.downloads.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-download"></i>
                    <h3>No Downloads</h3>
                    <p>Songs you download will appear here</p>
                </div>
            `;
            return;
        }
        
        this.container.innerHTML = `
            <div class="downloads-container">
                <h2>My Downloads</h2>
                <div class="downloads-list">
                    ${this.renderDownloads()}
                </div>
                <div class="downloads-stats">
                    <p>Total Downloads: ${this.downloads.length} songs</p>
                    <button class="btn btn-danger" id="clear-downloads-btn">Clear All Downloads</button>
                </div>
            </div>
        `;
        
        this.attachEventListeners();
    }

    renderDownloads() {
        return this.downloads.map(download => `
            <div class="download-item" data-id="${download._id}">
                <img src="${download.coverArt}" alt="${download.title}" class="download-cover">
                <div class="download-info">
                    <div class="download-title">${this.escapeHtml(download.title)}</div>
                    <div class="download-artist">${download.artist?.stageName || 'Unknown Artist'}</div>
                    <div class="download-date">Downloaded: ${this.formatDate(download.downloadedAt)}</div>
                </div>
                <div class="download-actions">
                    <button class="btn-icon play-download" data-id="${download._id}" title="Play">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn-icon delete-download" data-id="${download._id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    attachEventListeners() {
        const clearBtn = document.getElementById('clear-downloads-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllDownloads());
        }
        
        document.querySelectorAll('.play-download').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const download = this.downloads.find(d => d._id === id);
                if (download && window.app && window.app.audioPlayer) {
                    // Need to get full song object
                    const song = window.app.songs.find(s => s._id === id);
                    if (song) {
                        window.app.audioPlayer.loadSong(song, window.app.songs);
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
        this.downloads = this.downloads.filter(d => d._id !== songId);
        localStorage.setItem('bravo_downloaded_songs', JSON.stringify(this.downloads));
        this.render();
        window.helpers.showToast('Download removed', 'info');
    }

    clearAllDownloads() {
        if (confirm('Are you sure you want to clear all downloads?')) {
            this.downloads = [];
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(this.downloads));
            this.render();
            window.helpers.showToast('All downloads cleared', 'info');
        }
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

window.DownloadManager = DownloadManager;