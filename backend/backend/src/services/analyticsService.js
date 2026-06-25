import Analytics from '../models/Analytics.js';
import Song from '../models/Song.js';
import Artist from '../models/Artist.js';

class AnalyticsService {
    async trackEvent(userId, action, targetType, targetId, metadata = {}) {
        const analytics = new Analytics({
            user: userId,
            action: action,
            [targetType === 'song' ? 'song' : targetType === 'artist' ? 'artist' : null]: targetId,
            deviceInfo: metadata.deviceInfo || {},
            location: metadata.location || {},
            referrer: metadata.referrer,
            duration: metadata.duration,
            timestamp: new Date()
        });
        
        await analytics.save();
        
        if (action === 'stream' && targetType === 'song') {
            await Song.findByIdAndUpdate(targetId, { $inc: { playCount: 1 } });
        } else if (action === 'download' && targetType === 'song') {
            await Song.findByIdAndUpdate(targetId, { $inc: { downloadCount: 1 } });
        }
        
        return analytics;
    }
    
    async getTopContent(limit = 10, period = '30d') {
        let startDate = new Date();
        startDate.setDate(startDate.getDate() - (period === '7d' ? 7 : period === '30d' ? 30 : 90));
        
        const topSongs = await Analytics.aggregate([
            { $match: { action: 'stream', timestamp: { $gte: startDate } } },
            { $group: { _id: '$song', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: limit },
            { $lookup: { from: 'songs', localField: '_id', foreignField: '_id', as: 'song' } },
            { $unwind: '$song' }
        ]);
        
        const topArtists = await Analytics.aggregate([
            { $match: { action: 'stream', timestamp: { $gte: startDate } } },
            { $lookup: { from: 'songs', localField: 'song', foreignField: '_id', as: 'songData' } },
            { $unwind: '$songData' },
            { $group: { _id: '$songData.artist', streams: { $sum: 1 } } },
            { $sort: { streams: -1 } },
            { $limit: limit },
            { $lookup: { from: 'artists', localField: '_id', foreignField: '_id', as: 'artist' } },
            { $unwind: '$artist' }
        ]);
        
        return { topSongs, topArtists };
    }
}

export default new AnalyticsService();