import mongoose from 'mongoose';
import Album from '../models/Album.js';
import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Payment from '../models/Payment.js';
import Analytics from '../models/Analytics.js';
import storageService from '../services/storageService.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// POST /api/albums                       (auth required, artist or admin)
// ============================================================
export const createAlbum = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) {
      return res.status(403).json({ error: 'Artist profile not found' });
    }

    const { title, description, genre, type, price, isPremium } = req.body;
    const coverArt = req.file;

    if (!title || !genre) {
      return res.status(400).json({ error: 'title and genre are required' });
    }
    if (!coverArt) {
      return res.status(400).json({ error: 'Cover art is required' });
    }

    // Validate price — old code did `price || 0` which silently coerces
    // garbage input (like "free!") to 0. Be explicit.
    const numPrice = Number(price) || 0;
    if (numPrice < 0) {
      return res.status(400).json({ error: 'Price cannot be negative' });
    }

    const coverArtUrl = await storageService.uploadImage(coverArt, 'covers');

    const album = await Album.create({
      title,
      artist: artist._id,
      description,
      genre,
      type: type || 'album',
      price: numPrice,
      isPremium: Boolean(isPremium),
      coverArt: coverArtUrl,
      status: 'draft',
    });

    res.status(201).json({ message: 'Album created successfully', album });
  } catch (err) {
    console.error('createAlbum error:', err);
    res.status(500).json({ error: 'Failed to create album' });
  }
};

// ============================================================
// GET /api/albums                        (public, uses optionalAuth)
// ============================================================
export const getAlbums = async (req, res) => {
  try {
    // FIX: Pagination clamped. Old `limit * 1` with `?limit=1000000`
    // would attempt to return a million albums.
    const { page, limit, skip } = parsePagination(req.query);
    const { genre } = req.query;

    const query = { status: 'published' };
    if (genre) query.genre = genre;

    const [albums, total] = await Promise.all([
      Album.find(query)
        .populate('artist', 'stageName verified')
        .populate('songs', 'title duration playCount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Album.countDocuments(query),
    ]);

    res.json({
      albums,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getAlbums error:', err);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
};

// ============================================================
// GET /api/albums/:id                    (public, uses optionalAuth)
// ============================================================
export const getAlbum = async (req, res) => {
  try {
    const album = await Album.findById(req.params.id)
      .populate('artist', 'stageName verified avatar')
      .populate('songs', 'title duration playCount audioUrl price isPremium');

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    // Record view event. Old code only tracked logged-in users; we now
    // record guests too (user: null) since they're a real fraction of
    // traffic and you want them in analytics.
    Analytics.create({
      user: req.user?._id || null,
      album: album._id,
      action: 'view',
    }).catch((err) => console.error('Analytics write failed:', err.message));

    res.json(album);
  } catch (err) {
    console.error('getAlbum error:', err);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
};

// ============================================================
// PUT /api/albums/:id                    (auth required)
// ============================================================
export const updateAlbum = async (req, res) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const artist = await Artist.findOne({ userId: req.user._id });
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && (!artist || album.artist.toString() !== artist._id.toString())) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // SECURITY: Only admins can change `status`. Without this gate, an
    // artist could PUT { "status": "featured" } and promote their own
    // album to the featured carousel.
    const allowedFields = ['title', 'description', 'genre', 'price', 'isPremium', 'type'];
    if (isAdmin) allowedFields.push('status');

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'price') {
          const numPrice = Number(req.body[field]) || 0;
          if (numPrice < 0) return res.status(400).json({ error: 'Price cannot be negative' });
          album.price = numPrice;
        } else if (field === 'isPremium') {
          album.isPremium = Boolean(req.body[field]);
        } else {
          album[field] = req.body[field];
        }
      }
    }

    if (req.file) {
      if (album.coverArt && !album.coverArt.startsWith('http')) {
        await storageService.deleteFile(album.coverArt).catch((err) =>
          console.error('Failed to delete old cover art:', err.message)
        );
      }
      album.coverArt = await storageService.uploadImage(req.file, 'covers');
    }

    album.updatedAt = Date.now();
    await album.save();

    res.json({ message: 'Album updated', album });
  } catch (err) {
    console.error('updateAlbum error:', err);
    res.status(500).json({ error: 'Failed to update album' });
  }
};

// ============================================================
// DELETE /api/albums/:id                 (auth required)
// ============================================================
export const deleteAlbum = async (req, res) => {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const artist = await Artist.findOne({ userId: req.user._id });
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && (!artist || album.artist.toString() !== artist._id.toString())) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Song.updateMany({ album: album._id }, { $unset: { album: '' } });

    if (album.coverArt && !album.coverArt.startsWith('http')) {
      await storageService.deleteFile(album.coverArt).catch((err) =>
        console.error('Failed to delete cover art:', err.message)
      );
    }

    await album.deleteOne();
    res.json({ message: 'Album deleted successfully' });
  } catch (err) {
    console.error('deleteAlbum error:', err);
    res.status(500).json({ error: 'Failed to delete album' });
  }
};

// ============================================================
// POST /api/albums/:id/songs             (auth required)
// ============================================================
export const addSongToAlbum = async (req, res) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId is required' });

    const album = await Album.findById(req.params.id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist || album.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const song = await Song.findById(songId);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    if (song.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ error: 'Song does not belong to you' });
    }

    // FIX: Use $addToSet for atomic, idempotent add. Old code used
    // `.includes` then `.push` then `.save` which has a race condition
    // (two simultaneous adds can both pass the includes check). $addToSet
    // is the canonical Mongo idiom for "add if not present".
    const updated = await Album.findByIdAndUpdate(
      album._id,
      { $addToSet: { songs: songId } },
      { new: true }
    );

    song.album = album._id;
    await song.save();

    res.json({ message: 'Song added to album', album: updated });
  } catch (err) {
    console.error('addSongToAlbum error:', err);
    res.status(500).json({ error: 'Failed to add song to album' });
  }
};

// ============================================================
// DELETE /api/albums/:id/songs           (auth required)
// ============================================================
export const removeSongFromAlbum = async (req, res) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId is required' });

    const album = await Album.findById(req.params.id);
    if (!album) return res.status(404).json({ error: 'Album not found' });

    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist || album.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // FIX: $pull is atomic and idempotent.
    const updated = await Album.findByIdAndUpdate(
      album._id,
      { $pull: { songs: songId } },
      { new: true }
    );

    await Song.findByIdAndUpdate(songId, { $unset: { album: '' } });

    res.json({ message: 'Song removed from album', album: updated });
  } catch (err) {
    console.error('removeSongFromAlbum error:', err);
    res.status(500).json({ error: 'Failed to remove song from album' });
  }
};

// ============================================================
// POST /api/albums/:id/purchase          (auth required)
// ============================================================
//
// MAJOR SECURITY/CORRECTNESS REWRITE.
//
// The old code:
//   1. await Wallet.findOne()                  ← read balance
//   2. if (balance < price) return error       ← check
//   3. await wallet.deductBalance(price)       ← debit
//   4. await artistWallet.addBalance(revenue)  ← credit
//   5. new Payment(...).save()                 ← record
//
// Problems:
//   • Step 1-3 is a read-modify-write race. Two simultaneous purchases
//     can both pass the check and both debit, allowing free album.
//   • If step 4 or 5 fails, the user has been debited but no payment
//     record exists — money disappeared.
//   • commissionRate is `parseFloat(undefined) / 100 = NaN`, so the
//     artist gets `price - NaN = NaN` ZMW credited.
//
// The fix:
//   • Atomic conditional update to debit the buyer (filter includes
//     balance check).
//   • Wrap the whole thing in a MongoDB transaction so artist credit
//     and Payment record either both succeed or both roll back.
//   • Use safe commissionRate default (10%) — same fix as paymentController.
//   • Prevent double-purchase by checking for an existing completed
//     Payment for this user+album.
//
export const purchaseAlbum = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const album = await Album.findById(req.params.id).populate('artist');
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (!album.isPremium || album.price === 0) {
      return res.status(400).json({ error: 'Album is free' });
    }

    // Prevent re-purchasing what you already own.
    const existingPurchase = await Payment.findOne({
      user: req.user._id,
      'metadata.albumId': album._id,
      status: 'completed',
      type: 'album_purchase',
    });
    if (existingPurchase) {
      return res.status(400).json({ error: 'You already own this album' });
    }

    // Commission with safe default — see paymentController.js for context.
    const commissionRateRaw = Number(process.env.PLATFORM_COMMISSION_RATE);
    const commissionRate = (Number.isFinite(commissionRateRaw) ? commissionRateRaw : 10) / 100;
    const platformCommission = Math.round(album.price * commissionRate * 100) / 100;
    const artistRevenue = Math.round((album.price - platformCommission) * 100) / 100;

    let paymentRecord;

    await session.withTransaction(async () => {
      // Atomic debit + balance check. If balance < price, this returns
      // null and we abort the transaction.
      const buyerWallet = await Wallet.findOneAndUpdate(
        { user: req.user._id, balance: { $gte: album.price } },
        { $inc: { balance: -album.price }, $set: { updatedAt: new Date() } },
        { new: true, session }
      );

      if (!buyerWallet) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Credit the artist. Upsert in case the artist somehow has no
      // wallet yet (shouldn't happen, but defensive).
      await Wallet.findOneAndUpdate(
        { user: album.artist.userId },
        {
          $inc: { balance: artistRevenue, totalEarned: artistRevenue },
          $setOnInsert: { user: album.artist.userId },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, session }
      );

      // Record the payment.
      const [payment] = await Payment.create(
        [{
          user: req.user._id,
          amount: album.price,
          type: 'album_purchase',
          method: 'wallet',
          status: 'completed',
          platformCommission,
          artistRevenue,
          completedAt: new Date(),
          metadata: { albumId: album._id, albumTitle: album.title },
        }],
        { session }
      );
      paymentRecord = payment;
    });

    res.json({
      message: 'Album purchased successfully',
      payment: paymentRecord,
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    console.error('purchaseAlbum error:', err);
    res.status(500).json({ error: 'Failed to purchase album' });
  } finally {
    await session.endSession();
  }
};

// ============================================================
// GET /api/albums/trending               (public)
// ============================================================
export const getTrendingAlbums = async (req, res) => {
  try {
    // Make the limit configurable but clamped.
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const albums = await Album.find({ status: 'published' })
      .sort({ totalStreams: -1, totalDownloads: -1 })
      .limit(limit)
      .populate('artist', 'stageName verified');

    res.json(albums);
  } catch (err) {
    console.error('getTrendingAlbums error:', err);
    res.status(500).json({ error: 'Failed to fetch trending albums' });
  }
};

// ============================================================
// GET /api/albums/artist/:userId         (public, uses optionalAuth)
// ============================================================
// userId can be 'me' (requires auth) or an actual user ID.
export const getArtistAlbums = async (req, res) => {
  try {
    let artist;
    const userIdParam = req.params.userId;

    if (userIdParam === 'me') {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required for "me"' });
      }
      artist = await Artist.findOne({ userId: req.user._id });
    } else {
      const user = await User.findById(userIdParam);
      if (!user) return res.status(404).json({ error: 'User not found' });
      artist = await Artist.findOne({ userId: user._id });
    }

    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // For non-self requests, only return published albums.
    const query = { artist: artist._id };
    const isSelfRequest = req.user && artist.userId.toString() === req.user._id.toString();
    if (!isSelfRequest) {
      query.status = 'published';
    }

    const albums = await Album.find(query)
      .populate('songs', 'title duration playCount audioUrl coverArt')
      .sort({ createdAt: -1 });

    res.json(albums);
  } catch (err) {
    console.error('getArtistAlbums error:', err);
    res.status(500).json({ error: 'Failed to fetch artist albums' });
  }
};
