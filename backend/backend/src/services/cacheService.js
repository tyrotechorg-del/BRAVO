import { getRedis } from '../config/redis.js';

class CacheService {
    constructor() {
        this.defaultTTL = 3600;
    }
    
    async get(key) {
        try {
            const redis = getRedis();
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }
    
    async set(key, value, ttl = this.defaultTTL) {
        try {
            const redis = getRedis();
            await redis.setex(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }
    
    async delete(key) {
        try {
            const redis = getRedis();
            await redis.del(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }
    
    async deletePattern(pattern) {
        try {
            const redis = getRedis();
            const keys = await redis.keys(pattern);
            if (keys.length > 0) await redis.del(keys);
            return true;
        } catch (error) {
            console.error('Cache delete pattern error:', error);
            return false;
        }
    }
    
    async increment(key, by = 1) {
        try {
            const redis = getRedis();
            return await redis.incrby(key, by);
        } catch (error) {
            console.error('Cache increment error:', error);
            return null;
        }
    }
    
    async exists(key) {
        try {
            const redis = getRedis();
            return await redis.exists(key);
        } catch (error) {
            console.error('Cache exists error:', error);
            return false;
        }
    }
    
    async flushAll() {
        try {
            const redis = getRedis();
            await redis.flushall();
            return true;
        } catch (error) {
            console.error('Cache flush error:', error);
            return false;
        }
    }
}

export default new CacheService();