/**
 * Audio Player Service
 */

class PlayerService {
    constructor() {
        this.audio = new Audio();
        this.currentSong = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.volume = 0.7;
        this.progress = 0;
        this.duration = 0;
        this.listeners = new Map();
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.audio.addEventListener('timeupdate', () => {
            this.progress = this.audio.currentTime;
            this.emit('progress', { current: this.progress, duration: this.duration });
        });
        
        this.audio.addEventListener('loadedmetadata', () => {
            this.duration = this.audio.duration;
            this.emit('loaded', { duration: this.duration });
        });
        
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.emit('play', { song: this.currentSong });
        });
        
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.emit('pause');
        });
        
        this.audio.addEventListener('ended', () => {
            this.playNext();
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.emit('error', { error: e });
        });
    }

    loadSong(song, playlist = null) {
        this.currentSong = song;
        
        if (playlist) {
            this.playlist = playlist;
            this.currentIndex = playlist.findIndex(s => s._id === song._id);
        }
        
        this.audio.src = song.audioUrl;
        this.audio.load();
        this.emit('load', { song });
    }

    play() {
        this.audio.play().catch(error => {
            console.error('Play failed:', error);
            this.emit('error', { error: 'Playback failed' });
        });
    }

    pause() {
        this.audio.pause();
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    seek(time) {
        if (time >= 0 && time <= this.duration) {
            this.audio.currentTime = time;
            this.emit('seek', { time });
        }
    }

    setVolume(volume) {
        const newVolume = Math.max(0, Math.min(1, volume));
        this.audio.volume = newVolume;
        this.volume = newVolume;
        localStorage.setItem('player_volume', newVolume);
        this.emit('volume', { volume: newVolume });
    }

    playNext() {
        if (this.currentIndex + 1 < this.playlist.length) {
            this.currentIndex++;
            this.loadSong(this.playlist[this.currentIndex], this.playlist);
            this.play();
            this.emit('next', { song: this.currentSong, index: this.currentIndex });
        }
    }

    playPrevious() {
        if (this.currentIndex - 1 >= 0) {
            this.currentIndex--;
            this.loadSong(this.playlist[this.currentIndex], this.playlist);
            this.play();
            this.emit('previous', { song: this.currentSong, index: this.currentIndex });
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    getState() {
        return {
            currentSong: this.currentSong,
            isPlaying: this.isPlaying,
            currentTime: this.progress,
            duration: this.duration,
            volume: this.volume,
            playlist: this.playlist,
            currentIndex: this.currentIndex
        };
    }
}

window.PlayerService = PlayerService;