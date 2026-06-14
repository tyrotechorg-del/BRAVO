

class DownloadsPage {
    constructor() {
        this.downloads = [];
    }

    async render() {
        this._loadDownloads();
        return `
            <div class="downloads-page">
                <div class="page-header">
                    <h1>My Downloads</h1>
                    <p>Songs you've downloaded for offline listening.</p>
                </div>

                <div class="downloads-stats-bar">
                    <div class="stats-info">
                        <span><i class="fas fa-download"></i> <span id="download-count">${this.downloads.length}</span> songs</span>
                        <span><i class="fas fa-database"></i> Approx storage: <span id="storage-used">${this._approxStorage()}</span></span>
                    </div>
                    <button class="btn-danger btn-sm" type="button" id="clear-all-downloads"
                            style="display:${this.downloads.length > 0 ? 'inline-flex' : 'none'};">
                        <i class="fas fa-trash"></i> Clear All
                    </button>
                </div>

                <div id="downloads-list-container">
                    ${this._renderDownloadsList()}
                </div>
            </div>
        `;
    }

    async afterRender() {
        this._attachListeners();
    }

    _loadDownloads() {
        try {
            const stored = JSON.parse(localStorage.getItem('bravo_downloaded_songs') || '[]');
            this.downloads = Array.isArray(stored) ? stored : [];
        } catch {
            this.downloads = [];
        }
    }

    _renderDownloadsList() {
        if (this.downloads.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-download"></i>
                    <h3>No downloads yet</h3>
                    <p>Download songs to keep them ready to play.</p>
                    <button class="btn-primary" type="button" id="downloads-discover-btn">Browse Music</button>
                </div>
            `;
        }

        // Build via DOM-safe construction in afterRender, not innerHTML.
        // Here we just render a wrapper and populate in JS to keep
        // attribute interpolation safe.
        return `<div class="downloads-grid" id="downloads-grid"></div>`;
    }

    _attachListeners() {
        // Empty-state discover button
        const discoverBtn = document.getElementById('downloads-discover-btn');
        if (discoverBtn) {
            discoverBtn.addEventListener('click', () => {
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('browse');
                else window.location.hash = 'browse';
            });
        }

        // Clear all
        const clearBtn = document.getElementById('clear-all-downloads');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this._clearAll());
        }

        // Populate grid
        const grid = document.getElementById('downloads-grid');
        if (grid && this.downloads.length > 0) {
            this.downloads.forEach(d => grid.appendChild(this._buildCard(d)));
        }
    }

    _buildCard(download) {
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const card = document.createElement('div');
        card.className = 'download-card';
        card.setAttribute('data-id', download._id);

        card.innerHTML = `
            <img class="download-card-cover" alt="${this._escapeAttr(download.title || '')}">
            <div class="download-card-info">
                <h4>${this._escapeHtml(download.title || 'Untitled')}</h4>
                <p>${this._escapeHtml(download.artist?.stageName || 'Unknown Artist')}</p>
                <span class="download-date">
                    <i class="far fa-calendar-alt"></i> ${this._formatDate(download.downloadedAt)}
                </span>
            </div>
            <div class="download-card-actions">
                <button class="btn-icon" type="button" data-action="play" title="Play" aria-label="Play">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-icon" type="button" data-action="delete" title="Remove" aria-label="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        const img = card.querySelector('.download-card-cover');
        if (img) {
            img.src = this._safeImageUrl(download.coverArt) || fallback;
            img.addEventListener('error', () => { img.src = fallback; }, { once: true });
        }

        card.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'play') {
                this._playDownload(download);
            } else if (btn.dataset.action === 'delete') {
                this._deleteDownload(download._id, card);
            }
        });

        return card;
    }

    _playDownload(download) {
        if (!window.bravoApp?.audioPlayer) {
            Toast.show?.('Player not available', 'error');
            return;
        }
        // so the minimal stored object is enough. No need to look up a
        // stale window.bravoApp.songs cache.
        window.bravoApp.audioPlayer.loadSong(download, this.downloads);
    }

    _deleteDownload(songId, cardEl) {
        const doDelete = () => {
            this.downloads = this.downloads.filter(d => d._id !== songId);
            localStorage.setItem('bravo_downloaded_songs', JSON.stringify(this.downloads));
            if (cardEl?.parentNode) cardEl.parentNode.removeChild(cardEl);
            this._updateCounters();
            if (this.downloads.length === 0) {
                // Re-render to show empty state
                const container = document.getElementById('downloads-list-container');
                if (container) container.innerHTML = this._renderDownloadsList();
                this._attachListeners();
            }
            Toast.show?.('Download removed', 'info');
        };
        if (window.Modal?.confirm) {
            Modal.confirm('Remove this download?', doDelete);
        } else if (confirm('Remove this download?')) {
            doDelete();
        }
    }

    _clearAll() {
        const doClear = () => {
            this.downloads = [];
            localStorage.setItem('bravo_downloaded_songs', '[]');
            const container = document.getElementById('downloads-list-container');
            if (container) container.innerHTML = this._renderDownloadsList();
            this._updateCounters();
            this._attachListeners();
            Toast.show?.('All downloads cleared', 'info');
        };
        if (window.Modal?.confirm) {
            Modal.confirm('Delete all downloaded songs?', doClear);
        } else if (confirm('Delete all downloaded songs?')) {
            doClear();
        }
    }

    _updateCounters() {
        const count = document.getElementById('download-count');
        const storage = document.getElementById('storage-used');
        const clearBtn = document.getElementById('clear-all-downloads');
        if (count) count.textContent = String(this.downloads.length);
        if (storage) storage.textContent = this._approxStorage();
        if (clearBtn) clearBtn.style.display = this.downloads.length > 0 ? 'inline-flex' : 'none';
    }

    _approxStorage() {
        // ~5MB per song is the upload max (4MB typical MP3 at 320kbps,
        // 5MB at 256kbps stereo). This is a rough estimate.
        const mb = this.downloads.length * 5;
        if (mb >= 1024) return `~${(mb / 1024).toFixed(1)} GB`;
        return `~${mb} MB`;
    }

    _safeImageUrl(url) {
        if (!url || typeof url !== 'string') return null;
        if (/^javascript:/i.test(url) || /^data:text/i.test(url)) return null;
        return url;
    }

    _formatDate(date) {
        if (!date) return 'Unknown';
        try {
            return new Date(date).toLocaleDateString();
        } catch {
            return 'Unknown';
        }
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    _escapeAttr(text) {
        return this._escapeHtml(text);
    }
}

window.DownloadsPage = DownloadsPage;
