import Redis from 'ioredis';

let redisClient = null;

const connectRedis = () => {
    if (!redisClient) {
        redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true
        });
        
        redisClient.on('connect', () => {
            console.log('🔴 Redis connected');
        });
        
        redisClient.on('error', (err) => {
            console.error('Redis error:', err);
        });
        
        redisClient.on('reconnecting', () => {
            console.log('Redis reconnecting...');
        });
        
        redisClient.connect().catch(console.error);
    }
    
    return redisClient;
};

const getRedis = () => {
    if (!redisClient) {
        return connectRedis();
    }
    return redisClient;
};

export { connectRedis, getRedis };