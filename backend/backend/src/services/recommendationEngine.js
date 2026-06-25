import redisClient from '../config/redis.js';
import Song from '../models/Song.js';
import Like from '../models/Like.js';
import Analytics from '../models/Analytics.js';

class RecommendationEngine {
    constructor() {
        this.similarityMatrix = new Map();
    }

    async getCollaborativeRecommendations(userId, limit = 20) {
        try {
            const redis = await redisClient.getRedis();
            const cacheKey = `rec:collab:${userId}`;
            
            // Check cache
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            // Find similar users based on listening history
            const userLikes = await Like.find({ user: userId, type: 'song' }).select('song');
            const likedSongIds = userLikes.map(l => l.song);
            
            if (likedSongIds.length === 0) {
                return await this.getTrendingRecommendations(limit);
            }

            // Find users who liked similar songs
            const similarUsers = await Like.aggregate([
                { $match: { song: { $in: likedSongIds }, user: { $ne: userId } } },
                { $group: { _id: '$user', commonLikes: { $sum: 1 } } },
                { $sort: { commonLikes: -1 } },
                { $limit: 50 }
            ]);

            if (similarUsers.length === 0) {
                return await this.getTrendingRecommendations(limit);
            }

            // Get songs liked by similar users that current user hasn't liked
            const similarUserIds = similarUsers.map(u => u._id);
            const recommendations = await Like.aggregate([
                { $match: { user: { $in: similarUserIds }, type: 'song', song: { $nin: likedSongIds } } },
                { $group: { _id: '$song', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: limit },
                { $lookup: { from: 'songs', localField: '_id', foreignField: '_id', as: 'song' } },
                { $unwind: '$song' },
                { $match: { 'song.status': 'approved' } }
            ]);

            // Cache results for 1 hour
            await redis.setex(cacheKey, 3600, JSON.stringify(recommendations));

            return recommendations;
        } catch (error) {
            console.error('Collaborative filtering error:', error);
            return this.getTrendingRecommendations(limit);
        }
    }

    async getItemBasedRecommendations(songId, limit = 10) {
        try {
            const song = await Song.findById(songId);
            if (!song) return [];

            const redis = await redisClient.getRedis();
            const cacheKey = `rec:item:${songId}`;
            
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);

            // Find users who liked this song
            const usersWhoLiked = await Like.find({ song: songId, type: 'song' }).distinct('user');
            
            if (usersWhoLiked.length === 0) {
                return await Song.find({ 
                    genre: song.genre, 
                    status: 'approved',
                    _id: { $ne: songId }
                }).limit(limit);
            }

            // Find songs liked by those users
            const similarSongs = await Like.aggregate([
                { $match: { user: { $in: usersWhoLiked }, type: 'song', song: { $ne: songId } } },
                { $group: { _id: '$song', score: { $sum: 1 } } },
                { $sort: { score: -1 } },
                { $limit: limit },
                { $lookup: { from: 'songs', localField: '_id', foreignField: '_id', as: 'song' } },
                { $unwind: '$song' },
                { $match: { 'song.status': 'approved' } }
            ]);

            await redis.setex(cacheKey, 3600, JSON.stringify(similarSongs));
            
            return similarSongs;
        } catch (error) {
            console.error('Item-based recommendation error:', error);
            return [];
        }
    }

    async getMoodBasedRecommendations(mood, limit = 20) {
        const moodMap = {
            happy: ['Afrobeat', 'Dancehall', 'Amapiano'],
            sad: ['R&B', 'Soul', 'Ballad'],
            energetic: ['Hip Hop', 'Dancehall', 'Electronic'],
            relaxed: ['Reggae', 'Acoustic', 'Jazz'],
            romantic: ['R&B', 'Soul', 'Love Songs']
        };

        const genres = moodMap[mood] || ['Afrobeat', 'Hip Hop', 'R&B'];
        
        return await Song.find({
            genre: { $in: genres },
            status: 'approved'
        })
        .sort({ playCount: -1 })
        .limit(limit)
        .populate('artist', 'stageName');
    }

    async getTimeBasedRecommendations(limit = 20) {
        const hour = new Date().getHours();
        
        let timeOfDay;
        if (hour < 12) timeOfDay = 'morning';
        else if (hour < 17) timeOfDay = 'afternoon';
        else if (hour < 22) timeOfDay = 'evening';
        else timeOfDay = 'night';
        
        const timeMoods = {
            morning: ['Afrobeat', 'Gospel', 'Acoustic'],
            afternoon: ['Hip Hop', 'Amapiano', 'Dancehall'],
            evening: ['R&B', 'Reggae', 'Chill'],
            night: ['R&B', 'Soul', 'Lo-fi']
        };
        
        const genres = timeMoods[timeOfDay];
        
        return await Song.find({
            genre: { $in: genres },
            status: 'approved'
        })
        .sort({ playCount: -1, likeCount: -1 })
        .limit(limit);
    }

    async getSeasonalRecommendations(limit = 20) {
        const month = new Date().getMonth();
        
        let season;
        if (month >= 2 && month <= 4) season = 'spring';
        else if (month >= 5 && month <= 7) season = 'summer';
        else if (month >= 8 && month <= 10) season = 'autumn';
        else season = 'winter';
        
        const seasonalPlaylists = {
            summer: ['Party', 'Dancehall', 'Summer Hits'],
            winter: ['Cozy', 'Acoustic', 'Warm Vibes'],
            spring: ['Fresh', 'Upbeat', 'New Beginnings'],
            autumn: ['Reflective', 'Chill', 'Mellow']
        };
        
        const tags = seasonalPlaylists[season];
        
        return await Song.find({
            tags: { $in: tags },
            status: 'approved'
        })
        .sort({ playCount: -1 })
        .limit(limit);
    }

    async getTrendingRecommendations(limit = 20) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const trending = await Analytics.aggregate([
            { $match: { action: 'stream', timestamp: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$song', streamCount: { $sum: 1 } } },
            { $sort: { streamCount: -1 } },
            { $limit: limit },
            { $lookup: { from: 'songs', localField: '_id', foreignField: '_id', as: 'song' } },
            { $unwind: '$song' },
            { $match: { 'song.status': 'approved' } }
        ]);

        return trending;
    }

    async getHybridRecommendations(userId, limit = 20) {
        try {
            const [
                collaborative,
                trending,
                timeBased
            ] = await Promise.all([
                this.getCollaborativeRecommendations(userId, Math.ceil(limit / 2)),
                this.getTrendingRecommendations(Math.ceil(limit / 3)),
                this.getTimeBasedRecommendations(Math.ceil(limit / 3))
            ]);

            // Combine and deduplicate
            const allRecs = [...collaborative, ...trending, ...timeBased];
            const unique = new Map();
            
            for (const rec of allRecs) {
                if (!unique.has(rec._id?.toString() || rec.song?._id?.toString())) {
                    unique.set(rec._id?.toString() || rec.song?._id?.toString(), rec);
                }
            }
            
            return Array.from(unique.values()).slice(0, limit);
        } catch (error) {
            console.error('Hybrid recommendation error:', error);
            return this.getTrendingRecommendations(limit);
        }
    }

    async updateUserAffinity(userId, songId, action) {
        const redis = await redisClient.getRedis();
        const key = `affinity:${userId}`;
        
        const song = await Song.findById(songId);
        if (!song) return;
        
        const weight = action === 'like' ? 1 : action === 'stream' ? 0.5 : 0.1;
        
        await redis.hincrby(key, `genre:${song.genre}`, weight);
        await redis.hincrby(key, `artist:${song.artist}`, weight);
        
        if (song.tags) {
            song.tags.forEach(tag => {
                redis.hincrby(key, `tag:${tag}`, weight);
            });
        }
        
        // Expire after 30 days
        await redis.expire(key, 30 * 24 * 3600);
    }
}

export default new RecommendationEngine();