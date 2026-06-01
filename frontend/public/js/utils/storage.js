/**
 * Local Storage Manager
 */

class StorageManager {
    constructor() {
        this.prefix = 'bravo_';
        this.defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    // Get item
    get(key, useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        const fullKey = this.prefix + key;
        const item = storage.getItem(fullKey);
        
        if (!item) return null;
        
        try {
            const parsed = JSON.parse(item);
            if (parsed.expiry && Date.now() > parsed.expiry) {
                this.remove(key, useSession);
                return null;
            }
            return parsed.value;
        } catch {
            return item;
        }
    }

    // Set item
    set(key, value, ttl = null, useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        const fullKey = this.prefix + key;
        
        const data = {
            value: value,
            timestamp: Date.now(),
            expiry: ttl ? Date.now() + ttl : (useSession ? null : Date.now() + this.defaultTTL)
        };
        
        storage.setItem(fullKey, JSON.stringify(data));
        return true;
    }

    // Remove item
    remove(key, useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        const fullKey = this.prefix + key;
        storage.removeItem(fullKey);
        return true;
    }

    // Clear all
    clear(useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        const keys = Object.keys(storage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                storage.removeItem(key);
            }
        });
        return true;
    }

    // Check if exists
    has(key, useSession = false) {
        return this.get(key, useSession) !== null;
    }

    // Get all keys
    keys(useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        const keys = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.push(key.replace(this.prefix, ''));
            }
        }
        return keys;
    }

    // User storage
    setUser(user) { this.set('user', user); }
    getUser() { return this.get('user'); }
    
    // Token storage
    setToken(token) { this.set('token', token); }
    getToken() { return this.get('token'); }
    
    // Preferences
    setPreferences(prefs) {
        const current = this.getPreferences() || {};
        this.set('preferences', { ...current, ...prefs });
    }
    getPreferences() { return this.get('preferences') || {}; }
    
    // Recently played
    addRecentlyPlayed(song) {
        let recent = this.get('recently_played') || [];
        recent = recent.filter(s => s._id !== song._id);
        recent.unshift({ ...song, playedAt: Date.now() });
        recent = recent.slice(0, 50);
        this.set('recently_played', recent);
    }
    getRecentlyPlayed() { return this.get('recently_played') || []; }
    
    // Liked songs
    addLikedSong(songId) {
        let liked = this.get('liked_songs') || [];
        if (!liked.includes(songId)) {
            liked.push(songId);
            this.set('liked_songs', liked);
        }
    }
    removeLikedSong(songId) {
        let liked = this.get('liked_songs') || [];
        liked = liked.filter(id => id !== songId);
        this.set('liked_songs', liked);
    }
    getLikedSongs() { return this.get('liked_songs') || []; }
    isLiked(songId) { return this.getLikedSongs().includes(songId); }
    
    // Search history
    addSearchQuery(query) {
        let searches = this.get('search_history') || [];
        searches = searches.filter(s => s !== query);
        searches.unshift(query);
        searches = searches.slice(0, 20);
        this.set('search_history', searches);
    }
    getSearchHistory() { return this.get('search_history') || []; }
    clearSearchHistory() { this.remove('search_history'); }
    
    // Downloads
    addDownload(song) {
        let downloads = this.get('downloaded_songs') || [];
        if (!downloads.some(d => d._id === song._id)) {
            downloads.unshift({ ...song, downloadedAt: Date.now() });
            downloads = downloads.slice(0, 50);
            this.set('downloaded_songs', downloads);
        }
    }
    removeDownload(songId) {
        let downloads = this.get('downloaded_songs') || [];
        downloads = downloads.filter(d => d._id !== songId);
        this.set('downloaded_songs', downloads);
    }
    getDownloads() { return this.get('downloaded_songs') || []; }
    isDownloaded(songId) { return this.getDownloads().some(d => d._id === songId); }
    clearDownloads() { this.remove('downloaded_songs'); }
}

window.StorageManager = StorageManager;