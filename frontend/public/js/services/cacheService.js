/**
 * Cache Service
 */

class CacheService {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 3600000;
        this.maxSize = 100;
    }

    set(key, value, ttl = this.defaultTTL) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, {
            value,
            expires: Date.now() + ttl
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }

    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    async fetchOrSet(key, fetcher, ttl = this.defaultTTL) {
        const cached = this.get(key);
        if (cached) return cached;
        
        const fresh = await fetcher();
        this.set(key, fresh, ttl);
        return fresh;
    }

    // Song caching
    setSong(songId, data) { this.set(`song:${songId}`, data, 600000); }
    getSong(songId) { return this.get(`song:${songId}`); }
    
    // User caching
    setUser(userId, data) { this.set(`user:${userId}`, data, 300000); }
    getUser(userId) { return this.get(`user:${userId}`); }
    
    // Playlist caching
    setPlaylist(playlistId, data) { this.set(`playlist:${playlistId}`, data, 300000); }
    getPlaylist(playlistId) { return this.get(`playlist:${playlistId}`); }
}

window.CacheService = CacheService;