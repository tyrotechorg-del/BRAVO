/**
 * Application State Management
 */

class AppState {
    constructor() {
        this.state = {
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            currentSong: null,
            isPlaying: false,
            playlist: [],
            volume: 0.7,
            searchQuery: '',
            searchResults: null,
            theme: 'dark',
            notifications: [],
            unreadCount: 0
        };
        this.listeners = new Map();
        this.loadPersistedState();
    }

    loadPersistedState() {
        const savedTheme = localStorage.getItem('bravo_theme');
        if (savedTheme) {
            this.state.theme = savedTheme;
            document.body.classList.toggle('light-theme', savedTheme === 'light');
        }
        
        const savedVolume = localStorage.getItem('player_volume');
        if (savedVolume) {
            this.state.volume = parseFloat(savedVolume);
        }
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        this.notify(key, value, oldValue);
        
        if (key === 'theme') {
            localStorage.setItem('bravo_theme', value);
            document.body.classList.toggle('light-theme', value === 'light');
        }
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        return () => {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    notify(key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => callback(newValue, oldValue));
        }
        
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => callback(key, newValue, oldValue));
        }
    }

    setUser(user) {
        this.set('user', user);
        this.set('isAuthenticated', !!user);
        localStorage.setItem('user', JSON.stringify(user));
    }

    clearUser() {
        this.set('user', null);
        this.set('isAuthenticated', false);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    }

    setLoading(isLoading) {
        this.set('isLoading', isLoading);
    }

    setError(error) {
        this.set('error', error);
        setTimeout(() => this.set('error', null), 5000);
    }

    setCurrentSong(song) {
        this.set('currentSong', song);
    }

    setIsPlaying(isPlaying) {
        this.set('isPlaying', isPlaying);
    }

    setPlaylist(playlist) {
        this.set('playlist', playlist);
    }

    setVolume(volume) {
        this.set('volume', volume);
        localStorage.setItem('player_volume', volume);
    }

    addNotification(notification) {
        this.state.notifications.unshift(notification);
        this.set('unreadCount', this.state.unreadCount + 1);
    }

    markNotificationRead(id) {
        const notification = this.state.notifications.find(n => n._id === id);
        if (notification && !notification.read) {
            notification.read = true;
            this.set('unreadCount', Math.max(0, this.state.unreadCount - 1));
        }
    }
}

window.AppState = new AppState();