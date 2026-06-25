import mongoose from 'mongoose';
import Artist from '../models/Artist.js';
import Song from '../models/Song.js';
import Album from '../models/Album.js';
import Wallet from '../models/Wallet.js';
import Withdrawal from '../models/Withdrawal.js';
import Transaction from '../models/Transaction.js';
import Analytics from '../models/Analytics.js';
import subscriptionService from '../services/subscriptionService.js';
import notificationService from '../services/notificationService.js';
// FIX: These were imported dynamically inside handlers in the old code.
// Top-level imports are faster, cleaner, and visible to static analysis.
import storageService from '../services/storageService.js';
import audioService from '../services/audioService.js';
import { parsePagination } from '../utils/apiResponse.js';
import { streamFileWithRange } from '../utils/streamRange.js';

const DEFAULT_COVER_ART = 'images/bravo.png';

// ============================================================
// GET /api/artists/dashboard             (auth required)
// ============================================================
export const getDashboard = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) {
      return res.status(403).json({ error: 'Artist profile not found' });
    }

    // FIX: Run independent queries in parallel — old code did them
    // sequentially, costing ~4× the time on a typical artist dashboard.
    const [songs, albums, wallet, recentSongs] = await Promise.all([
      Song.find({ artist: artist._id, status: 'approved' }),
      Album.find({ artist: artist._id }),
      Wallet.findOne({ user: req.user._id }),
      Song.find({ artist: artist._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    const totalStreams = songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
    const totalDownloads = songs.reduce((sum, s) => sum + (s.downloadCount || 0), 0);
    const totalRevenue = songs.reduce((sum, s) => sum + (s.revenue || 0), 0);

    res.json({
      artist,
      stats: {
        totalSongs: songs.length,
        totalAlbums: albums.length,
        totalStreams,
        totalDownloads,
        totalRevenue,
        monthlyListeners: artist.monthlyListeners || 0,
        walletBalance: wallet?.balance || 0,
      },
      recentSongs,
      subscriptionStatus: artist.subscriptionStatus,
      currentPlan: artist.currentPlan,
      uploadCredits: artist.uploadCredits,
      subscriptionExpiry: artist.subscriptionExpiry,
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
};

// ============================================================
// GET /api/artists/analytics             (auth required)
// ============================================================
//
// FIX: Old code did 30 sequential `Analytics.countDocuments` calls
// (one per day in the past 30 days) — at ~50ms each, that's ~1.5s
// of unnecessary serial DB time per dashboard load.
//
// Replaced with a single aggregation pipeline that groups by day
// using $dateToString. Same result in ~50ms total.
//
export const getAnalytics = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(403).json({ error: 'Artist profile not found' });

    const songs = await Song.find({ artist: artist._id });
    const songIds = songs.map((s) => s._id);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [streamsLast30Days, topSongs, dailyStreamsAgg] = await Promise.all([
      // Total streams in last 30 days
      Analytics.countDocuments({
        song: { $in: songIds },
        action: 'stream',
        timestamp: { $gte: thirtyDaysAgo },
      }),

      // Top 5 songs by play count
      Song.find({ artist: artist._id }).sort({ playCount: -1 }).limit(5),

      // Daily breakdown in ONE aggregation — was 30 separate queries.
      Analytics.aggregate([
        {
          $match: {
            song: { $in: songIds },
            action: 'stream',
            timestamp: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            streams: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Fill in zero-stream days so the chart doesn't have gaps.
    const dailyStreams = [];
    const aggMap = new Map(dailyStreamsAgg.map((d) => [d._id, d.streams]));
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyStreams.push({ date: key, streams: aggMap.get(key) || 0 });
    }

    res.json({
      totalStreams: songs.reduce((sum, s) => sum + (s.playCount || 0), 0),
      streamsLast30Days,
      totalRevenue: songs.reduce((sum, s) => sum + (s.revenue || 0), 0),
      topSongs,
      dailyStreams,
      totalDownloads: songs.reduce((sum, s) => sum + (s.downloadCount || 0), 0),
      totalLikes: songs.reduce((sum, s) => sum + (s.likeCount || 0), 0),
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// ============================================================
// GET /api/artists/earnings              (auth required)
// ============================================================
//
// FIX: Same pattern as analytics — old code ran 6 separate aggregations
// (one per month). Replaced with a single grouped aggregation.
//
export const getEarnings = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [wallet, transactions, monthlyAgg] = await Promise.all([
      Wallet.findOne({ user: req.user._id }),
      Transaction.find({ user: req.user._id, type: 'royalty' })
        .sort({ createdAt: -1 })
        .limit(50),
      Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'royalty',
            createdAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // Fill in missing months with 0.
    const monthlyEarnings = [];
    const aggMap = new Map(
      monthlyAgg.map((m) => [`${m._id.year}-${m._id.month}`, m.total])
    );
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyEarnings.push({
        month: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
        earnings: aggMap.get(key) || 0,
      });
    }

    res.json({
      balance: wallet?.balance || 0,
      totalEarned: wallet?.totalEarned || 0,
      totalWithdrawn: wallet?.totalWithdrawn || 0,
      pendingWithdrawal: wallet?.pendingWithdrawal || 0,
      transactions,
      monthlyEarnings,
    });
  } catch (err) {
    console.error('getEarnings error:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};

// ============================================================
// PUT /api/artists/profile               (auth required)
// ============================================================
export const updateArtistProfile = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    // Allowlist — DON'T just iterate `req.body` keys.
    const updates = ['stageName', 'genres', 'website', 'recordLabel', 'establishmentYear', 'bio'];
    for (const field of updates) {
      if (req.body[field] !== undefined) {
        artist[field] = req.body[field];
      }
    }

    if (req.file) {
      // No more dynamic import — storageService imported at the top.
      artist.bannerImage = await storageService.uploadImage(req.file, 'banners');
    }

    artist.updatedAt = Date.now();
    await artist.save();

    res.json({ message: 'Artist profile updated', artist });
  } catch (err) {
    console.error('updateArtistProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ============================================================
// GET /api/artists/songs                 (auth required)
// ============================================================
export const getArtistSongs = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const songs = await Song.find({ artist: artist._id })
      .sort({ createdAt: -1 })
      .populate('album', 'title');

    res.json(songs);
  } catch (err) {
    console.error('getArtistSongs error:', err);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
};

// ============================================================
// GET /api/artists/albums                (auth required)
// ============================================================
export const getArtistAlbums = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const albums = await Album.find({ artist: artist._id })
      .sort({ createdAt: -1 })
      .populate('songs', 'title duration');

    res.json(albums);
  } catch (err) {
    console.error('getArtistAlbums error:', err);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
};

// ============================================================
// GET /api/artists/:id                   (public, optionalAuth)
// ============================================================
// Public artist profile by Artist _id. `userId` is populated so the client
// knows which User to follow (follow targets a User, not an Artist profile).
export const getArtistById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid artist id' });
    }

    const artist = await Artist.findById(id)
      .populate('userId', 'username fullName avatar');

    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    let isFollowing = false;
    if (req.user && artist.userId) {
      const followedId = artist.userId._id || artist.userId;
      isFollowing = (req.user.following || []).some(
        (f) => f.toString() === followedId.toString()
      );
    }

    res.json({ artist, isFollowing });
  } catch (err) {
    console.error('getArtistById error:', err);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
};

// ============================================================
// POST /api/artists/withdraw             (auth required)
// ============================================================
//
// SAME FIX AS walletController.withdraw — race-condition-free
// atomic balance check + deduction. The original code:
//
//   const wallet = await Wallet.findOne(...);
//   if (wallet.balance < amount) error;
//   wallet.pendingWithdrawal += amount;
//   wallet.balance -= amount;
//   await wallet.save();
//
// allowed two concurrent withdraws to both pass the check and both
// debit, letting an artist withdraw up to 2× their balance.
//
export const requestWithdrawal = async (req, res) => {
  try {
    const { amount, method, accountDetails } = req.body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const minWithdrawal = Number(process.env.MIN_WITHDRAWAL_AMOUNT) || 50;
    if (numAmount < minWithdrawal) {
      return res.status(400).json({ error: `Minimum withdrawal amount is K${minWithdrawal}` });
    }
    if (!method || !accountDetails) {
      return res.status(400).json({ error: 'method and accountDetails are required' });
    }

    // Atomic balance check + deduction.
    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: req.user._id, balance: { $gte: numAmount } },
      {
        $inc: { balance: -numAmount, pendingWithdrawal: numAmount },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    try {
      const withdrawal = await Withdrawal.create({
        user: req.user._id,
        amount: numAmount,
        method,
        accountDetails,
        status: 'pending',
      });

      // Best-effort admin notification — don't block on failure.
      notificationService.notifyAdmins(
        'New Withdrawal Request',
        `${req.user.username} requested withdrawal of K${numAmount}`,
        { withdrawalId: withdrawal._id }
      ).catch((err) => console.error('Admin notification failed:', err.message));

      res.json({ message: 'Withdrawal request submitted', withdrawal });
    } catch (innerErr) {
      // Rollback the wallet debit since Withdrawal.create failed.
      await Wallet.findOneAndUpdate(
        { user: req.user._id },
        { $inc: { balance: numAmount, pendingWithdrawal: -numAmount } }
      );
      throw innerErr;
    }
  } catch (err) {
    console.error('requestWithdrawal error:', err);
    res.status(500).json({ error: 'Failed to request withdrawal' });
  }
};

// ============================================================
// GET /api/artists/withdrawals           (auth required)
// ============================================================
export const getWithdrawalHistory = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Withdrawal.countDocuments({ user: req.user._id }),
    ]);

    res.json({ withdrawals, total, totalPages: Math.ceil(total / limit), currentPage: page });
  } catch (err) {
    console.error('getWithdrawalHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch withdrawal history' });
  }
};

// ============================================================
// POST /api/artists/upload-credits       (auth required)
// ============================================================
//
// FIX: Same wallet race condition as album purchase. Wrapped in a
// transaction with atomic conditional debit.
//
export const purchaseUploadCredits = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { packageId } = req.body;

    // Centralised package definitions — easier to update than scattered
    // magic numbers. Could later move to env or a config file.
    const PACKAGES = {
      single:   { credits: 1,  price: 10 },
      bundle5:  { credits: 5,  price: 40 },
      bundle10: { credits: 10, price: 70 },
    };

    const pkg = PACKAGES[packageId];
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) {
      return res.status(403).json({ error: 'Artist profile not found' });
    }

    let updatedArtist;

    await session.withTransaction(async () => {
      // Atomic debit + balance check.
      const debited = await Wallet.findOneAndUpdate(
        { user: req.user._id, balance: { $gte: pkg.price } },
        { $inc: { balance: -pkg.price }, $set: { updatedAt: new Date() } },
        { new: true, session }
      );

      if (!debited) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Set credit expiry to 30 days from now.
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);

      // Atomic credit grant.
      updatedArtist = await Artist.findByIdAndUpdate(
        artist._id,
        {
          $inc: { uploadCredits: pkg.credits },
          $set: { uploadCreditsExpiry: expiry },
        },
        { new: true, session }
      );

      await Transaction.create([{
        user: req.user._id,
        amount: pkg.price,
        type: 'upload_credit',
        status: 'completed',
        description: `Purchased ${pkg.credits} upload credits`,
        reference: `UC_${artist._id}_${Date.now()}`,
      }], { session });
    });

    res.json({
      message: 'Upload credits purchased',
      credits: updatedArtist.uploadCredits,
      expiry: updatedArtist.uploadCreditsExpiry,
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    console.error('purchaseUploadCredits error:', err);
    res.status(500).json({ error: 'Failed to purchase credits' });
  } finally {
    await session.endSession();
  }
};

// ============================================================
// GET /api/artists/subscription          (auth required)
// ============================================================
export const getSubscriptionStatus = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(404).json({ error: 'Artist profile not found' });

    const subscription = await subscriptionService.getArtistSubscription(req.user._id);

    res.json({
      status: artist.subscriptionStatus,
      plan: artist.currentPlan,
      expiryDate: artist.subscriptionExpiry,
      uploadCredits: artist.uploadCredits,
      uploadCreditsExpiry: artist.uploadCreditsExpiry,
      subscription,
    });
  } catch (err) {
    console.error('getSubscriptionStatus error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
};

// ============================================================
// POST /api/artists/upload-video         (auth required)
// ============================================================
export const uploadVideoSong = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(403).json({ error: 'Artist profile not found' });

    if (!artist.canUpload()) {
      return res.status(403).json({
        error: 'Upload limit reached. Please subscribe or purchase upload credits.',
      });
    }

    const { title, genre, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;

    if (!title || !genre) {
      return res.status(400).json({ error: 'title and genre are required' });
    }
    if (!req.files || !req.files.video) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    const videoFile = req.files.video[0];
    const coverArt = req.files.coverArt ? req.files.coverArt[0] : null;

    const numPrice = Number(price) || 0;
    if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative' });

    // Parallel uploads + duration probe.
    const [videoUrl, coverArtUrl, duration] = await Promise.all([
      storageService.uploadVideo(videoFile, artist._id),
      coverArt
        ? storageService.uploadImage(coverArt, 'covers')
        : Promise.resolve(DEFAULT_COVER_ART),
      audioService.getDuration(videoFile.path).catch(() => 180),
    ]);

    const parseList = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val) return val.split(',').map((s) => s.trim()).filter(Boolean);
      return [];
    };

    const song = await Song.create({
      title,
      artist: artist._id,
      genre,
      duration,
      audioUrl: videoUrl, // for audio-only playback paths
      videoUrl,
      coverArt: coverArtUrl,
      price: numPrice,
      isPremium: isPremium === 'true' || isPremium === true,
      isVideo: true,
      lyrics: lyrics || '',
      tags: parseList(tags),
      featuredArtists: parseList(featuredArtists),
      status: 'pending',
    });

    if (albumId) {
      const album = await Album.findById(albumId);
      if (album && album.artist.toString() === artist._id.toString()) {
        await Album.findByIdAndUpdate(albumId, { $addToSet: { songs: song._id } });
      }
    }

    await artist.useUploadCredit();
    await Artist.findByIdAndUpdate(artist._id, { $inc: { songsUploaded: 1 } });

    notificationService.notifyAdmins(
      'New Video Song Pending Approval',
      `${artist.stageName} uploaded a new video: ${title}`,
      { songId: song._id, type: 'video' }
    ).catch((err) => console.error('Admin notification failed:', err.message));

    res.status(201).json({
      message: 'Video song uploaded successfully, pending approval',
      song: {
        _id: song._id,
        title: song.title,
        videoUrl: song.videoUrl,
        status: song.status,
      },
    });
  } catch (err) {
    console.error('uploadVideoSong error:', err);
    res.status(500).json({ error: 'Video upload failed' });
  }
};

// ============================================================
// POST /api/artists/upload-album         (auth required)
// ============================================================
export const uploadAlbum = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(403).json({ error: 'Artist profile not found' });

    const { title, description, genre, type, price, isPremium } = req.body;

    if (!title || !genre) return res.status(400).json({ error: 'title and genre are required' });
    if (!req.file) return res.status(400).json({ error: 'Cover art is required' });

    const numPrice = Number(price) || 0;
    if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative' });

    const coverArtUrl = await storageService.uploadImage(req.file, 'covers');

    const album = await Album.create({
      title,
      artist: artist._id,
      description,
      genre,
      type: type || 'album',
      price: numPrice,
      isPremium: isPremium === 'true' || isPremium === true,
      coverArt: coverArtUrl,
      status: 'draft',
    });

    await Artist.findByIdAndUpdate(artist._id, { $inc: { albumsUploaded: 1 } });

    res.status(201).json({
      message: 'Album created successfully. Add songs to publish.',
      album: {
        _id: album._id,
        title: album.title,
        coverArt: album.coverArt,
        status: album.status,
      },
    });
  } catch (err) {
    console.error('uploadAlbum error:', err);
    res.status(500).json({ error: 'Album creation failed' });
  }
};

// ============================================================
// PUT /api/artists/albums/:albumId/publish  (auth required)
// ============================================================
export const publishAlbum = async (req, res) => {
  try {
    const album = await Album.findById(req.params.albumId);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist || album.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!album.songs || album.songs.length === 0) {
      return res.status(400).json({ error: 'Cannot publish empty album' });
    }

    album.status = 'published';
    album.releaseDate = new Date();
    await album.save();

    await Song.updateMany({ _id: { $in: album.songs } }, { album: album._id });

    res.json({ message: 'Album published successfully', album });
  } catch (err) {
    console.error('publishAlbum error:', err);
    res.status(500).json({ error: 'Failed to publish album' });
  }
};

// ============================================================
// GET /api/artists/videos                (auth required — own videos)
// ============================================================
export const getArtistVideos = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const videos = await Song.find({ artist: artist._id, isVideo: true }).sort({ createdAt: -1 });

    res.json(videos);
  } catch (err) {
    console.error('getArtistVideos error:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

// ============================================================
// GET /api/artists/all-videos            (public)
// ============================================================
export const getAllVideos = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [videos, total] = await Promise.all([
      Song.find({ isVideo: true, status: 'approved' })
        .populate('artist', 'stageName verified avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Song.countDocuments({ isVideo: true, status: 'approved' }),
    ]);

    res.json({
      videos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalVideos: total,
      },
    });
  } catch (err) {
    console.error('getAllVideos error:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

// ============================================================
// GET /api/artists/videos/:id/stream     (uses optionalAuth)
// ============================================================
// Range-aware streaming. See `utils/streamRange.js` for details.
export const streamVideo = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song || !song.isVideo) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (song.isPremium) {
      if (!req.user) return res.status(401).json({ error: 'Premium content requires sign-in' });
      if (req.user.role !== 'admin') {
        const hasSubscription = await subscriptionService.hasActiveSubscription(
          req.user._id,
          'listener_premium'
        );
        if (!hasSubscription) {
          return res.status(403).json({ error: 'Premium content requires a subscription' });
        }
      }
    }

    await streamFileWithRange({
      url: song.videoUrl,
      req,
      res,
      contentType: 'video/mp4',
    });

    Song.findByIdAndUpdate(song._id, { $inc: { playCount: 1 } }).catch((err) =>
      console.error('Play count update failed:', err.message)
    );
  } catch (err) {
    console.error('streamVideo error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Video streaming failed' });
  }
};
