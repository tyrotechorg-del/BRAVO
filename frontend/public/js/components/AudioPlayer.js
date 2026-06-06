/**
 * Audio Player Component - FULLY FIXED with Download, Like & Share (No Login Required)
 */

class AudioPlayer {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.audio = new Audio();
        this.currentSong = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isShuffled = false;
        this.isRepeating = false;
        this.shuffledPlaylist = [];
        this.originalPlaylist = [];
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.apiUrl = window.API_BASE_URL;
        this.songsAPI = new SongsAPI();
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.setupAudioEvents();
        console.log('AudioPlayer initialized');
    }

    getFullUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        if (url.startsWith('/static')) return `${this.staticUrl}${url}`;
        return url;
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="player-container">
                <div class="player-info">
                    <img class="player-cover" id="player-cover" src="${window.getDefaultImage ? window.getDefaultImage() : '/images/bravo.png'}">
                    <div class="player-details">
                        <div class="player-title" id="player-title">Select a song</div>
                        <div class="player-artist" id="player-artist">Bravo Music</div>
                    </div>
                </div>
                
                <div class="player-controls">
                    <button class="player-btn" id="shuffle-btn" title="Shuffle">
                        <i class="fas fa-random"></i>
                    </button>
                    <button class="player-btn" id="prev-btn" title="Previous">
                        <i class="fas fa-backward"></i>
                    </button>
                    <button class="player-btn play-pause" id="play-pause-btn" title="Play/Pause">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="player-btn" id="next-btn" title="Next">
                        <i class="fas fa-forward"></i>
                    </button>
                    <button class="player-btn" id="repeat-btn" title="Repeat">
                        <i class="fas fa-redo-alt"></i>
                    </button>
                </div>
                
                <div class="player-progress">
                    <span class="current-time" id="current-time">0:00</span>
                    <div class="progress-bar" id="progress-bar">
                        <div class="progress-fill" id="progress-fill"></div>
                    </div>
                    <span class="duration" id="duration">0:00</span>
                </div>
                
                <div class="player-extra">
                    <button class="player-btn" id="like-player-btn" title="Like">
                        <i class="far fa-heart"></i>
                    </button>
                    <button class="player-btn" id="share-player-btn" title="Share">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="player-btn" id="download-player-btn" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `;
        
        if (this.isShuffled) {
            const shuffleBtn = document.getElementById('shuffle-btn');
            if (shuffleBtn) shuffleBtn.style.color = '#6c63ff';
        }
        if (this.isRepeating) {
            const repeatBtn = document.getElementById('repeat-btn');
            if (repeatBtn) repeatBtn.style.color = '#6c63ff';
        }
    }

    setupEventListeners() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const shuffleBtn = document.getElementById('shuffle-btn');
        const repeatBtn = document.getElementById('repeat-btn');
        const progressBar = document.getElementById('progress-bar');
        const downloadBtn = document.getElementById('download-player-btn');
        const shareBtn = document.getElementById('share-player-btn');
        const likeBtn = document.getElementById('like-player-btn');

        if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlay());
        if (prevBtn) prevBtn.addEventListener('click', () => this.playPrevious());
        if (nextBtn) nextBtn.addEventListener('click', () => this.playNext());
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        if (repeatBtn) repeatBtn.addEventListener('click', () => this.toggleRepeat());
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadCurrentSong());
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareCurrentSong());
        if (likeBtn) likeBtn.addEventListener('click', () => this.toggleLikeCurrentSong());
        if (progressBar) progressBar.addEventListener('click', (e) => this.seek(e));
    }

    async toggleLikeCurrentSong() {
        if (!this.currentSong) {
            Toast.show('No song selected', 'warning');
            return;
        }

        const likeBtn = document.getElementById('like-player-btn');
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(this.currentSong._id);

        // Like/Unlike without login - store in localStorage only
        if (isLiked) {
            const newLiked = likedSongs.filter(id => id !== this.currentSong._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(newLiked));
            if (likeBtn) {
                likeBtn.innerHTML = '<i class="far fa-heart"></i>';
                likeBtn.title = 'Like';
            }
            Toast.show('Removed from liked songs', 'info');
        } else {
            likedSongs.push(this.currentSong._id);
            localStorage.setItem('bravo_liked_songs', JSON.stringify(likedSongs));
            if (likeBtn) {
                likeBtn.innerHTML = '<i class="fas fa-heart" style="color: #ff4757;"></i>';
                likeBtn.title = 'Unlike';
            }
            Toast.success('Added to liked songs! ❤️');
        }
    }

    updateLikeButtonState() {
        if (!this.currentSong) return;
        
        const likeBtn = document.getElementById('like-player-btn');
        if (!likeBtn) return;
        
        const likedSongs = JSON.parse(localStorage.getItem('bravo_liked_songs') || '[]');
        const isLiked = likedSongs.includes(this.currentSong._id);
        
        if (isLiked) {
            likeBtn.innerHTML = '<i class="fas fa-heart" style="color: #ff4757;"></i>';
            likeBtn.title = 'Unlike';
        } else {
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';
            likeBtn.title = 'Like';
        }
    }

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.handleSongEnd());
        this.audio.addEventListener('play', () => this.updatePlayButton(true));
        this.audio.addEventListener('pause', () => this.updatePlayButton(false));
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', this.audio.error);
            let errorMsg = 'Error playing audio. ';
            switch(this.audio.error?.code) {
                case 2: errorMsg = 'Network error. Please check your connection.'; break;
                case 3: errorMsg = 'Audio decoding error. File may be corrupted.'; break;
                case 4: errorMsg = 'Audio format not supported.'; break;
                default: errorMsg = 'Cannot play this song.';
            }
            Toast.error(errorMsg);
        });
    }

    handleSongEnd() {
        if (this.isRepeating) {
            this.audio.currentTime = 0;
            this.play();
        } else {
            this.playNext();
        }
    }

    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        const shuffleBtn = document.getElementById('shuffle-btn');
        
        if (this.isShuffled) {
            this.enableShuffleMode();
            if (shuffleBtn) shuffleBtn.style.color = '#6c63ff';
            Toast.success('Shuffle mode ON');
        } else {
            this.disableShuffleMode();
            if (shuffleBtn) shuffleBtn.style.color = '';
            Toast.info('Shuffle mode OFF');
        }
    }

    enableShuffleMode() {
        if (this.playlist.length === 0) return;
        
        if (this.originalPlaylist.length === 0) {
            this.originalPlaylist = [...this.playlist];
        }
        
        this.shuffledPlaylist = [...this.playlist];
        for (let i = this.shuffledPlaylist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledPlaylist[i], this.shuffledPlaylist[j]] = [this.shuffledPlaylist[j], this.shuffledPlaylist[i]];
        }
        
        const currentSongId = this.currentSong?._id;
        if (currentSongId) {
            this.currentIndex = this.shuffledPlaylist.findIndex(s => s._id === currentSongId);
            if (this.currentIndex === -1) this.currentIndex = 0;
        }
    }

    disableShuffleMode() {
        if (this.originalPlaylist.length > 0) {
            this.playlist = [...this.originalPlaylist];
            this.shuffledPlaylist = [];
            
            const currentSongId = this.currentSong?._id;
            if (currentSongId) {
                this.currentIndex = this.playlist.findIndex(s => s._id === currentSongId);
                if (this.currentIndex === -1) this.currentIndex = 0;
            }
        }
    }

    toggleRepeat() {
        this.isRepeating = !this.isRepeating;
        const repeatBtn = document.getElementById('repeat-btn');
        if (repeatBtn) {
            repeatBtn.style.color = this.isRepeating ? '#6c63ff' : '';
            Toast.info(this.isRepeating ? 'Repeat ONE - song will loop' : 'Repeat OFF');
        }
    }

    getCurrentPlaylist() {
        if (this.isShuffled && this.shuffledPlaylist.length > 0) {
            return this.shuffledPlaylist;
        }
        return this.playlist;
    }

    loadSong(song, playlist = null) {
        if (!song) {
            console.error('No song provided');
            return;
        }
        
        console.log('Loading song:', song.title);
        this.currentSong = song;
        
        if (playlist) {
            this.playlist = playlist;
            this.originalPlaylist = [...playlist];
            
            if (this.isShuffled) {
                this.enableShuffleMode();
            } else {
                this.shuffledPlaylist = [];
                this.currentIndex = this.playlist.findIndex(s => s._id === song._id);
                if (this.currentIndex === -1) this.currentIndex = 0;
            }
        }
        
        // Get audio URL
        let audioUrl = song.audioUrl;
        if (audioUrl && !audioUrl.startsWith('http')) {
            audioUrl = this.getFullUrl(audioUrl);
        }
        
        console.log('Audio URL:', audioUrl);
        
        // Clear and load new audio
        const wasPlaying = this.isPlaying;
        this.audio.pause();
        this.audio.src = '';
        this.audio.load();
        this.audio.src = audioUrl;
        this.audio.load();
        
        // Update UI
        const titleEl = document.getElementById('player-title');
        const artistEl = document.getElementById('player-artist');
        const coverEl = document.getElementById('player-cover');
        
        if (titleEl) titleEl.textContent = song.title || 'Unknown Title';
        if (artistEl) artistEl.textContent = song.artist?.stageName || 'Unknown Artist';
        
        let coverUrl = song.coverArt;
        if (coverUrl && !coverUrl.startsWith('http')) {
            coverUrl = this.getFullUrl(coverUrl);
        }
        if (coverEl) coverEl.src = coverUrl || (window.getDefaultImage ? window.getDefaultImage() : '/images/bravo.png');
        
        // Update like button
        this.updateLikeButtonState();
        
        // Auto-play
        const playWhenReady = () => {
            this.audio.removeEventListener('canplay', playWhenReady);
            this.play();
        };
        
        this.audio.addEventListener('canplay', playWhenReady, { once: true });
        
        // Fallback timeout
        setTimeout(() => {
            if (!this.isPlaying && this.audio.readyState >= 2) {
                this.play();
            }
        }, 500);
        
        // Track play count
        this.addToRecentlyPlayed(song);
        this.songsAPI.share(song._id, 'play').catch(() => {});
    }

    play() {
        if (!this.audio.src) {
            console.warn('No audio source');
            return;
        }
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.isPlaying = true;
                })
                .catch(error => {
                    console.error('Play failed:', error);
                    this.isPlaying = false;
                    Toast.error('Cannot play this song. The file might be inaccessible.');
                });
        }
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    playNext() {
        if (this.playlist.length === 0) return;
        
        const currentPlaylist = this.getCurrentPlaylist();
        let nextIndex;
        
        if (this.isShuffled) {
            do {
                nextIndex = Math.floor(Math.random() * currentPlaylist.length);
            } while (nextIndex === this.currentIndex && currentPlaylist.length > 1);
        } else {
            nextIndex = (this.currentIndex + 1) % currentPlaylist.length;
        }
        
        this.currentIndex = nextIndex;
        const nextSong = currentPlaylist[this.currentIndex];
        
        if (nextSong) {
            this.loadSong(nextSong, this.playlist);
        }
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        
        const currentPlaylist = this.getCurrentPlaylist();
        let prevIndex;
        
        if (this.isShuffled) {
            do {
                prevIndex = Math.floor(Math.random() * currentPlaylist.length);
            } while (prevIndex === this.currentIndex && currentPlaylist.length > 1);
        } else {
            prevIndex = (this.currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        }
        
        this.currentIndex = prevIndex;
        const prevSong = currentPlaylist[this.currentIndex];
        
        if (prevSong) {
            this.loadSong(prevSong, this.playlist);
        }
    }

    async downloadCurrentSong() {
        if (!this.currentSong) {
            Toast.warning('No song selected');
            return;
        }
        
        // Download without login
        Toast.info(`Downloading "${this.currentSong.title}"...`);
        
        try {
            let audioUrl = this.currentSong.audioUrl;
            if (audioUrl && !audioUrl.startsWith('http')) {
                audioUrl = this.getFullUrl(audioUrl);
            }
            
            console.log('Downloading from:', audioUrl);
            
            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentSong.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // Save to downloads storage
            this.saveToDownloads(this.currentSong);
            
            // Visual feedback on download button
            const downloadBtn = document.getElementById('download-player-btn');
            if (downloadBtn) {
                const originalHtml = downloadBtn.innerHTML;
                downloadBtn.innerHTML = '<i class="fas fa-check"></i>';
                downloadBtn.style.color = '#4caf50';
                setTimeout(() => {
                    downloadBtn.innerHTML = originalHtml;
                    downloadBtn.style.color = '';
                }, 2000);
            }
            
            Toast.success(`Downloaded "${this.currentSong.title}"! 📥`);
            
        } catch (error) {
            console.error('Download failed:', error);
            Toast.error('Download failed. Please try again.');
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

    shareCurrentSong() {
        if (!this.currentSong) {
            Toast.warning('No song selected');
            return;
        }
        
        const songUrl = `${window.location.origin}/#song/${this.currentSong._id}`;
        const shareText = `Check out "${this.currentSong.title}" by ${this.currentSong.artist?.stageName || 'Unknown Artist'} on Bravo Music! 🎵`;
        
        // Use Web Share API if available (mobile)
        if (navigator.share) {
            navigator.share({
                title: this.currentSong.title,
                text: shareText,
                url: songUrl
            }).catch(() => {});
            return;
        }
        
        // Fallback to modal
        if (window.ShareModal) {
            ShareModal.show(this.currentSong);
        } else {
            // Simple copy to clipboard fallback
            navigator.clipboard.writeText(songUrl).then(() => {
                Toast.success('Link copied to clipboard!');
            }).catch(() => {
                Toast.info('Share: ' + songUrl);
            });
        }
        
        // Track share (optional, doesn't block)
        this.songsAPI.share(this.currentSong._id, 'copy').catch(() => {});
    }

    updateProgress() {
        const progressFill = document.getElementById('progress-fill');
        const currentTimeSpan = document.getElementById('current-time');
        
        if (progressFill && this.audio.duration && !isNaN(this.audio.duration)) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            progressFill.style.width = `${percent}%`;
        }
        
        if (currentTimeSpan && !isNaN(this.audio.currentTime)) {
            const mins = Math.floor(this.audio.currentTime / 60);
            const secs = Math.floor(this.audio.currentTime % 60);
            currentTimeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    updateDuration() {
        const durationSpan = document.getElementById('duration');
        if (durationSpan && this.audio.duration && !isNaN(this.audio.duration)) {
            const mins = Math.floor(this.audio.duration / 60);
            const secs = Math.floor(this.audio.duration % 60);
            durationSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    updatePlayButton(isPlaying) {
        const btn = document.getElementById('play-pause-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }
    }

    seek(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            this.audio.currentTime = percent * this.audio.duration;
        }
    }

    addToRecentlyPlayed(song) {
        let recent = JSON.parse(localStorage.getItem('bravo_history') || '[]');
        recent = recent.filter(s => s._id !== song._id);
        recent.unshift({
            _id: song._id,
            title: song.title,
            artist: song.artist,
            coverArt: song.coverArt,
            playedAt: Date.now()
        });
        recent = recent.slice(0, 50);
        localStorage.setItem('bravo_history', JSON.stringify(recent));
    }
}

window.AudioPlayer = AudioPlayer;