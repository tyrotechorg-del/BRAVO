/**
 * Playlist Card Component
 */

class PlaylistCard {
    constructor(playlist, container, onPlay, onDelete = null) {
        this.playlist = playlist;
        this.container = container;
        this.onPlay = onPlay;
        this.onDelete = onDelete;
        this.render();
    }

    render() {
        const coverUrl = this.playlist.songs?.[0]?.coverArt || 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200';
        
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.setAttribute('data-playlist-id', this.playlist._id);
        card.innerHTML = `
            <div class="playlist-cover">
                <img src="${coverUrl}" alt="${this.escapeHtml(this.playlist.name)}">
                <div class="playlist-overlay">
                    <button class="play-playlist-btn" title="Play All">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <span class="playlist-song-count">${this.playlist.songs?.length || 0} songs</span>
            </div>
            <div class="playlist-info">
                <h4 class="playlist-name">${this.escapeHtml(this.playlist.name)}</h4>
                <p class="playlist-details">
                    ${this.playlist.isPublic ? 'Public' : 'Private'}
                </p>
                ${this.playlist.description ? `<p class="playlist-description">${this.escapeHtml(this.playlist.description)}</p>` : ''}
            </div>
            <div class="playlist-actions">
                <button class="btn-icon edit-playlist-btn" title="Edit Playlist">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-playlist-btn" title="Delete Playlist">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn-icon share-playlist-btn" title="Share Playlist">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
        `;
        
        this.attachEventListeners(card);
        this.container.appendChild(card);
    }

    attachEventListeners(card) {
        const playBtn = card.querySelector('.play-playlist-btn');
        const editBtn = card.querySelector('.edit-playlist-btn');
        const deleteBtn = card.querySelector('.delete-playlist-btn');
        const shareBtn = card.querySelector('.share-playlist-btn');
        
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onPlay && this.playlist.songs?.length > 0) {
                    this.onPlay(this.playlist.songs[0], this.playlist.songs);
                }
            });
        }
        
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editPlaylist();
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePlaylist();
            });
        }
        
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sharePlaylist();
            });
        }
        
        card.addEventListener('click', () => {
            window.location.hash = `playlist/${this.playlist._id}`;
        });
    }

    editPlaylist() {
        Modal.show({
            title: 'Edit Playlist',
            content: `
                <form id="edit-playlist-form">
                    <div class="form-group">
                        <label>Playlist Name</label>
                        <input type="text" name="name" value="${this.escapeHtml(this.playlist.name)}" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="3">${this.escapeHtml(this.playlist.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="isPublic" ${this.playlist.isPublic ? 'checked' : ''}>
                            Make Public
                        </label>
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save', class: 'btn-primary', action: 'save', onClick: () => {
                    const form = document.getElementById('edit-playlist-form');
                    const name = form.querySelector('[name="name"]').value;
                    const description = form.querySelector('[name="description"]').value;
                    const isPublic = form.querySelector('[name="isPublic"]').checked;
                    
                    Toast.show('Playlist updated!', 'success');
                }}
            ]
        });
    }

    deletePlaylist() {
        Modal.confirm(`Are you sure you want to delete "${this.playlist.name}"?`, async () => {
            if (this.onDelete) await this.onDelete(this.playlist._id);
            this.container.removeChild(this.container.querySelector(`[data-playlist-id="${this.playlist._id}"]`));
            Toast.show('Playlist deleted', 'success');
        });
    }

    sharePlaylist() {
        const url = `${window.location.origin}/#playlist/${this.playlist._id}`;
        navigator.clipboard.writeText(url);
        Toast.show('Playlist link copied to clipboard!', 'success');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.PlaylistCard = PlaylistCard;