import { getRedis } from '../config/redis.js';

export const cache = (duration) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;
    
    try {
      const redis = getRedis();
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
      
      const originalSend = res.json;
      
      res.json = function(data) {
        redis.setex(key, duration, JSON.stringify(data));
        originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache error:', error);
      next();
    }
  };
};

export const clearCache = async (pattern) => {
  try {
    const redis = getRedis();
    const keys = await redis.keys(`cache:${pattern}`);
    if (keys.length) {
      await redis.del(keys);
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
};

export default { cache, clearCache };