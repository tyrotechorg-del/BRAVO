import mongoose from 'mongoose';
import Analytics from '../models/Analytics.js';
import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js'; // FIX: was dynamic-imported

// Whitelisted period values. The old code accepted arbitrary strings
// like "30d" and then did `parseInt("30d") = 30`, but on `getDownloadAnalytics`
// it did `parseInt(period)` directly without the switch — `parseInt("30d")`
// happens to be 30, but `parseInt("invalid")` is NaN and `setDate(NaN)`
// produces an Invalid Date which silently breaks the query.
const PERIODS = {
  '7d':  7,
  '30d': 30,
  '90d': 90,
  '1y':  365,
};

function periodToStartDate(period) {
  const days = PERIODS[period] ?? PERIODS['30d'];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  return startDate;
}

// ============================================================
// GET /api/analytics/streams             (auth required)
// ============================================================
//
// Artists see their own data, admins see global. The original code
// silently returned global data to listeners and other non-admin/non-artist
// users — a privacy leak. Now we explicitly gate.
//
export const getStreamAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const startDate = periodToStartDate(period);

    const query = { action: 'stream', timestamp: { $gte: startDate } };

    if (req.user.role === 'artist') {
      const artist = await Artist.findOne({ userId: req.user._id });
      if (!artist) return res.status(403).json({ error: 'Artist profile not found' });
      const songs = await Song.find({ artist: artist._id }).select('_id');
      query.song = { $in: songs.map((s) => s._id) };
    } else if (req.user.role !== 'admin') {
      // Listeners and other roles can't read analytics.
      return res.status(403).json({ error: 'Access denied' });
    }

    const [totalStreams, dailyStreams] = await Promise.all([
      Analytics.countDocuments(query),
      Analytics.aggregate([
        { $match: query },
        {
          $group: {
            // ISO date string — easier on the frontend than {year,month,day}.
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      totalStreams,
      period,
      dailyStreams: dailyStreams.map((d) => ({ date: d._id, streams: d.count })),
    });
  } catch (err) {
    console.error('getStreamAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch stream analytics' });
  }
};

// ============================================================
// GET /api/analytics/downloads           (auth required)
// ============================================================
//
// FIX: Old code did `parseInt(period)` directly on "30d" / "7d" etc.
// `parseInt("30d")` happens to be 30 (parseInt stops at first non-digit)
// but `parseInt("1y")` is 1, not 365. Now uses the same whitelist.
//
// FIX: Same artist/admin scope gate as streams.
//
export const getDownloadAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const startDate = periodToStartDate(period);

    const query = { action: 'download', timestamp: { $gte: startDate } };

    if (req.user.role === 'artist') {
      const artist = await Artist.findOne({ userId: req.user._id });
      if (!artist) return res.status(403).json({ error: 'Artist profile not found' });
      const songs = await Song.find({ artist: artist._id }).select('_id');
      query.song = { $in: songs.map((s) => s._id) };
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const totalDownloads = await Analytics.countDocuments(query);

    res.json({ totalDownloads, period });
  } catch (err) {
    console.error('getDownloadAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch download analytics' });
  }
};

// ============================================================
// GET /api/analytics/revenue             (ADMIN ONLY)
// ============================================================
//
// SECURITY: This used to be accessible to ANYONE with a valid token —
// listeners could call `/api/analytics/revenue` and see total platform
// revenue and commission. Now restricted to admins.
//
// Also: Payment is imported at the top now (was dynamic).
//
export const getRevenueAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const revenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          total: { $sum: '$amount' },
          commission: { $sum: '$platformCommission' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 24 }, // Cap to 2 years to keep response sizes reasonable.
    ]);

    res.json(revenue);
  } catch (err) {
    console.error('getRevenueAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
};

// ============================================================
// GET /api/analytics/top-songs           (admin only)
// ============================================================
export const getTopSongs = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Clamp limit — old code did `parseInt(limit)` with no upper bound.
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const topSongs = await Analytics.aggregate([
      { $match: { action: 'stream' } },
      { $group: { _id: '$song', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'songs',
          localField: '_id',
          foreignField: '_id',
          as: 'song',
        },
      },
      { $unwind: '$song' },
      {
        $lookup: {
          from: 'artists',
          localField: 'song.artist',
          foreignField: '_id',
          as: 'artist',
        },
      },
      { $unwind: '$artist' },
    ]);

    res.json(topSongs);
  } catch (err) {
    console.error('getTopSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch top songs' });
  }
};

// ============================================================
// GET /api/analytics/top-artists         (admin only)
// ============================================================
export const getTopArtists = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const topArtists = await Analytics.aggregate([
      { $match: { action: 'stream' } },
      {
        $lookup: {
          from: 'songs',
          localField: 'song',
          foreignField: '_id',
          as: 'song',
        },
      },
      { $unwind: '$song' },
      { $group: { _id: '$song.artist', streams: { $sum: 1 } } },
      { $sort: { streams: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'artists',
          localField: '_id',
          foreignField: '_id',
          as: 'artist',
        },
      },
      { $unwind: '$artist' },
    ]);

    res.json(topArtists);
  } catch (err) {
    console.error('getTopArtists error:', err);
    res.status(500).json({ error: 'Failed to fetch top artists' });
  }
};

// ============================================================
// GET /api/analytics/engagement          (admin only)
// ============================================================
//
// FIX: Old code did `(activeUsers / totalUsers * 100)` with no
// divide-by-zero guard. On a fresh database with zero users, this
// returns "NaN" as a string. Now returns 0 explicitly.
//
export const getUserEngagement = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalUsers, activeUsersAgg] = await Promise.all([
      User.countDocuments(),
      Analytics.aggregate([
        { $match: { timestamp: { $gte: thirtyDaysAgo }, user: { $ne: null } } },
        { $group: { _id: '$user' } },
        { $count: 'count' },
      ]),
    ]);

    const activeUsers = activeUsersAgg[0]?.count || 0;
    const engagementRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    res.json({
      totalUsers,
      activeUsersLast30Days: activeUsers,
      engagementRate: engagementRate.toFixed(2),
    });
  } catch (err) {
    console.error('getUserEngagement error:', err);
    res.status(500).json({ error: 'Failed to fetch user engagement' });
  }
};

// ============================================================
// GET /api/analytics/geographic          (admin only)
// ============================================================
export const getGeographicAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const topCountries = await Analytics.aggregate([
      { $match: { action: 'stream', 'location.country': { $exists: true, $ne: null } } },
      { $group: { _id: '$location.country', streams: { $sum: 1 } } },
      { $sort: { streams: -1 } },
      { $limit: 20 },
    ]);

    res.json(topCountries);
  } catch (err) {
    console.error('getGeographicAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch geographic analytics' });
  }
};
