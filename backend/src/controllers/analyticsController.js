import Analytics from '../models/Analytics.js';
import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import User from '../models/User.js';

export const getStreamAnalytics = async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        let startDate = new Date();
        
        switch(period) {
            case '7d': startDate.setDate(startDate.getDate() - 7); break;
            case '30d': startDate.setDate(startDate.getDate() - 30); break;
            case '90d': startDate.setDate(startDate.getDate() - 90); break;
            case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
        }
        
        let query = { action: 'stream', timestamp: { $gte: startDate } };
        
        if (req.user.role === 'artist') {
            const artist = await Artist.findOne({ userId: req.user._id });
            const songs = await Song.find({ artist: artist._id });
            query.song = { $in: songs.map(s => s._id) };
        }
        
        const totalStreams = await Analytics.countDocuments(query);
        
        const dailyStreams = await Analytics.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        
        res.json({
            totalStreams,
            period,
            dailyStreams: dailyStreams.map(d => ({
                date: `${d._id.year}-${d._id.month}-${d._id.day}`,
                streams: d.count
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch stream analytics' });
    }
};

export const getDownloadAnalytics = async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        let startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        
        const totalDownloads = await Analytics.countDocuments({
            action: 'download',
            timestamp: { $gte: startDate }
        });
        
        res.json({ totalDownloads, period });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch download analytics' });
    }
};

export const getRevenueAnalytics = async (req, res) => {
    try {
        const Payment = await import('../models/Payment.js');
        const revenue = await Payment.default.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: '$amount' },
                    commission: { $sum: '$platformCommission' }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);
        
        res.json(revenue);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
};

export const getTopSongs = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const topSongs = await Analytics.aggregate([
            { $match: { action: 'stream' } },
            { $group: { _id: '$song', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'songs',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'song'
                }
            },
            { $unwind: '$song' },
            {
                $lookup: {
                    from: 'artists',
                    localField: 'song.artist',
                    foreignField: '_id',
                    as: 'artist'
                }
            },
            { $unwind: '$artist' }
        ]);
        
        res.json(topSongs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch top songs' });
    }
};

export const getTopArtists = async (req, res) => {
    try {
        const topArtists = await Analytics.aggregate([
            { $match: { action: 'stream' } },
            { $lookup: {
                from: 'songs',
                localField: 'song',
                foreignField: '_id',
                as: 'song'
            }},
            { $unwind: '$song' },
            { $group: { _id: '$song.artist', streams: { $sum: 1 } } },
            { $sort: { streams: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'artists',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'artist'
                }
            },
            { $unwind: '$artist' }
        ]);
        
        res.json(topArtists);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
};

export const getUserEngagement = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await Analytics.aggregate([
            { $match: { timestamp: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) } } },
            { $group: { _id: '$user' } },
            { $count: 'count' }
        ]);
        
        res.json({
            totalUsers,
            activeUsersLast30Days: activeUsers[0]?.count || 0,
            engagementRate: ((activeUsers[0]?.count || 0) / totalUsers * 100).toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user engagement' });
    }
};

export const getGeographicAnalytics = async (req, res) => {
    try {
        const topCountries = await Analytics.aggregate([
            { $match: { action: 'stream', 'location.country': { $exists: true } } },
            { $group: { _id: '$location.country', streams: { $sum: 1 } } },
            { $sort: { streams: -1 } },
            { $limit: 10 }
        ]);
        
        res.json(topCountries);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch geographic analytics' });
    }
};