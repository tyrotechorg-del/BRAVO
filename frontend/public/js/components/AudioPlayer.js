/**
 * Audio Player Component - SEQUENTIAL DEFAULT WITH WORKING RANDOM MODE
 */

class AudioPlayer {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        this.audio = new Audio();
        this.currentSong = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isShuffled = false; // FALSE = Sequential mode (DEFAULT)
        this.isRepeating = false;
        this.shuffledPlaylist = [];
        this.originalPlaylist = [];
        this.apiUrl = window.API_BASE_URL;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.setupAudioEvents();
        console.log('AudioPlayer initialized - Sequential play mode (default)');
    }

    getFullUrl(url) {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `${this.staticUrl}${url}`;
        return url;
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="player-container">
                <div class="player-info">
                    <img class="player-cover" id="player-cover" src="${window.getDefaultImage()}">
                    <div class="player-details">
                        <div class="player-title" id="player-title">Select a song</div>
                        <div class="player-artist" id="player-artist">Bravo Music</div>
                    </div>
                </div>
                
                <div class="player-controls">
                    <button class="player-btn" id="shuffle-btn" title="Shuffle Mode">
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
                    <button class="player-btn share-player-btn" id="share-player-btn" title="Share Current Song">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="player-btn download-player-btn" id="download-player-btn" title="Download Current Song">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `;
        
        const shuffleBtn = document.getElementById('shuffle-btn');
        const repeatBtn = document.getElementById('repeat-btn');
        
        if (shuffleBtn && this.isShuffled) {
            shuffleBtn.style.color = '#6c63ff';
            shuffleBtn.title = 'Shuffle Mode ON';
        }
        if (repeatBtn && this.isRepeating) {
            repeatBtn.style.color = '#6c63ff';
            repeatBtn.title = 'Repeat Mode ON';
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

        if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlay());
        if (prevBtn) prevBtn.addEventListener('click', () => this.playPrevious());
        if (nextBtn) nextBtn.addEventListener('click', () => this.playNext());
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        if (repeatBtn) repeatBtn.addEventListener('click', () => this.toggleRepeat());
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadCurrentSong());
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareCurrentSong());
        if (progressBar) progressBar.addEventListener('click', (e) => this.seek(e));
    }

    setupAudioEvents() {
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('ended', () => this.handleSongEnd());
        this.audio.addEventListener('play', () => this.updatePlayButton(true));
        this.audio.addEventListener('pause', () => this.updatePlayButton(false));
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            Toast.show('Error playing audio. Please try again.', 'error');
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
            // Enable shuffle mode - create shuffled playlist
            this.enableShuffleMode();
            if (shuffleBtn) {
                shuffleBtn.style.color = '#6c63ff';
                shuffleBtn.title = 'Shuffle Mode ON';
            }
            Toast.show('Shuffle mode ON - songs will play randomly', 'success');
        } else {
            // Disable shuffle mode - restore sequential order
            this.disableShuffleMode();
            if (shuffleBtn) {
                shuffleBtn.style.color = '';
                shuffleBtn.title = 'Shuffle Mode OFF';
            }
            Toast.show('Shuffle mode OFF - sequential play', 'info');
        }
    }

    enableShuffleMode() {
        if (this.playlist.length === 0) return;
        
        // Save original playlist order if not already saved
        if (this.originalPlaylist.length === 0) {
            this.originalPlaylist = [...this.playlist];
        }
        
        // Create shuffled version of the playlist
        this.shuffledPlaylist = [...this.playlist];
        for (let i = this.shuffledPlaylist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledPlaylist[i], this.shuffledPlaylist[j]] = [this.shuffledPlaylist[j], this.shuffledPlaylist[i]];
        }
        
        // Find current song in shuffled playlist and update index
        const currentSongId = this.currentSong?._id;
        if (currentSongId) {
            this.currentIndex = this.shuffledPlaylist.findIndex(s => s._id === currentSongId);
            if (this.currentIndex === -1) {
                this.currentIndex = 0;
            }
        }
    }

    disableShuffleMode() {
        if (this.originalPlaylist.length > 0) {
            this.playlist = [...this.originalPlaylist];
            this.shuffledPlaylist = [];
            
            // Find current song in original playlist
            const currentSongId = this.currentSong?._id;
            if (currentSongId) {
                this.currentIndex = this.playlist.findIndex(s => s._id === currentSongId);
                if (this.currentIndex === -1) {
                    this.currentIndex = 0;
                }
            }
        }
    }

    toggleRepeat() {
        this.isRepeating = !this.isRepeating;
        const repeatBtn = document.getElementById('repeat-btn');
        if (repeatBtn) {
            if (this.isRepeating) {
                repeatBtn.style.color = '#6c63ff';
                repeatBtn.title = 'Repeat Mode ON';
                Toast.show('Repeat ONE - current song will loop', 'success');
            } else {
                repeatBtn.style.color = '';
                repeatBtn.title = 'Repeat Mode OFF';
                Toast.show('Repeat OFF', 'info');
            }
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
        } else {
            // Update index in current playlist
            const currentPlaylist = this.getCurrentPlaylist();
            this.currentIndex = currentPlaylist.findIndex(s => s._id === song._id);
            if (this.currentIndex === -1) this.currentIndex = 0;
        }
        
        let audioUrl = song.audioUrl;
        if (audioUrl && !audioUrl.startsWith('http') && audioUrl.startsWith('/uploads')) {
            audioUrl = `${this.staticUrl}${audioUrl}`;
        }
        
        console.log('Loading song:', song.title);
        this.audio.src = audioUrl;
        this.audio.load();
        
        const titleEl = document.getElementById('player-title');
        const artistEl = document.getElementById('player-artist');
        const coverEl = document.getElementById('player-cover');
        
        if (titleEl) titleEl.textContent = song.title || 'Unknown Title';
        if (artistEl) artistEl.textContent = song.artist?.stageName || 'Unknown Artist';
        
        let coverUrl = song.coverArt;
        if (coverUrl && !coverUrl.startsWith('http') && coverUrl.startsWith('/uploads')) {
            coverUrl = `${this.staticUrl}${coverUrl}`;
        }
        if (coverEl) coverEl.src = coverUrl || window.getDefaultImage();
        
        this.play();
        this.addToRecentlyPlayed(song);
    }

    play() {
        this.audio.play().catch(error => {
            console.error('Play failed:', error);
            Toast.show('Cannot play this song. The file might be inaccessible.', 'error');
        });
        this.isPlaying = true;
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
            // Random next for shuffle mode
            do {
                nextIndex = Math.floor(Math.random() * currentPlaylist.length);
            } while (nextIndex === this.currentIndex && currentPlaylist.length > 1);
        } else {
            // Sequential next - go to next song in order
            nextIndex = (this.currentIndex + 1) % currentPlaylist.length;
        }
        
        this.currentIndex = nextIndex;
        const nextSong = currentPlaylist[this.currentIndex];
        
        if (nextSong) {
            console.log('Playing next song:', nextSong.title, this.isShuffled ? '(shuffled)' : '(sequential)');
            this.loadSong(nextSong, this.playlist);
        }
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        
        const currentPlaylist = this.getCurrentPlaylist();
        let prevIndex;
        
        if (this.isShuffled) {
            // Random previous for shuffle mode (play a different random song)
            do {
                prevIndex = Math.floor(Math.random() * currentPlaylist.length);
            } while (prevIndex === this.currentIndex && currentPlaylist.length > 1);
        } else {
            // Sequential previous - go to previous song in order
            prevIndex = (this.currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        }
        
        this.currentIndex = prevIndex;
        const prevSong = currentPlaylist[this.currentIndex];
        
        if (prevSong) {
            console.log('Playing previous song:', prevSong.title, this.isShuffled ? '(shuffled)' : '(sequential)');
            this.loadSong(prevSong, this.playlist);
        }
    }

    async downloadCurrentSong() {
        if (!this.currentSong) {
            Toast.show('No song selected', 'warning');
            return;
        }
        
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            Toast.show('Please login to download', 'info');
            window.location.hash = 'login';
            return;
        }
        
        Toast.show(`Downloading "${this.currentSong.title}"...`, 'info');
        
        try {
            let audioUrl = this.currentSong.audioUrl;
            if (audioUrl && !audioUrl.startsWith('http') && audioUrl.startsWith('/uploads')) {
                audioUrl = `${this.staticUrl}${audioUrl}`;
            }
            
            const response = await fetch(audioUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentSong.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.saveToDownloads(this.currentSong);
            Toast.show(`Downloaded "${this.currentSong.title}" successfully! 📥`, 'success');
        } catch (error) {
            console.error('Download failed:', error);
            Toast.show('Download failed. Please try again.', 'error');
        }
    }

    shareCurrentSong() {
        if (!this.currentSong) {
            Toast.show('No song selected', 'warning');
            return;
        }
        
        ShareModal.show(this.currentSong);
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

    updateProgress() {
        const progressFill = document.getElementById('progress-fill');
        const currentTimeSpan = document.getElementById('current-time');
        
        if (progressFill && this.audio.duration) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            progressFill.style.width = `${percent}%`;
        }
        
        if (currentTimeSpan) {
            const mins = Math.floor(this.audio.currentTime / 60);
            const secs = Math.floor(this.audio.currentTime % 60);
            currentTimeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    updateDuration() {
        const durationSpan = document.getElementById('duration');
        if (durationSpan && this.audio.duration) {
            const mins = Math.floor(this.audio.duration / 60);
            const secs = Math.floor(this.audio.duration % 60);
            durationSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    updatePlayButton(isPlaying) {
        const btn = document.getElementById('play-pause-btn');
        if (btn) {
            const icon = btn.querySelector('i');
            icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }

    seek(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        if (this.audio.duration) {
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