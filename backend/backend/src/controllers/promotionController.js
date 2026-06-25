import mongoose from 'mongoose';
import Promotion from '../models/Promotion.js';
import Artist from '../models/Artist.js';
import Song from '../models/Song.js';
import Wallet from '../models/Wallet.js';
import Payment from '../models/Payment.js';
import paymentService from '../services/paymentService.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// Promotion packages — server-side source of truth
// ============================================================
const PROMOTION_PACKAGES = {
  homepage:  { name: 'Homepage Feature',     price: 500,  duration: 7,  description: 'Your song featured on homepage for 7 days' },
  trending:  { name: 'Trending Section',     price: 300,  duration: 7,  description: 'Placement in trending section for 7 days' },
  playlist:  { name: 'Playlist Placement',   price: 200,  duration: 14, description: 'Added to official playlists for 14 days' },
  sponsored: { name: 'Sponsored Placement',  price: 1000, duration: 30, description: 'Sponsored placement across platform for 30 days' },
};

// ============================================================
// GET /api/promotions/packages           (public)
// ============================================================
export const getPromotionPackages = async (req, res) => {
  res.json(PROMOTION_PACKAGES);
};

// ============================================================
// POST /api/promotions/purchase          (auth required)
// ============================================================
//
// MAJOR FIX — THIS WAS A MONEY BUG.
//
// The original code:
//   1. Created a Promotion record with status: 'pending'
//   2. Returned success
//   (... and never took any money)
//
// The artist could call this endpoint and get a free promotion. There
// was no Payment.create, no wallet debit, no paymentService call. The
// promotion would sit in 'pending' forever — but cron jobs / featured
// content queries might still include it.
//
// The fix supports two payment paths:
//   1. paymentMethod === 'wallet': atomic debit from in-app wallet,
//      promotion activated immediately.
//   2. paymentMethod === 'mobile_money' (any provider): initiate via
//      paymentService, promotion stays 'pending' until webhook completes.
//
// Wallet path is wrapped in a MongoDB transaction so the wallet debit,
// the Payment record, and the Promotion creation either all succeed
// or all roll back.
//
export const purchasePromotion = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { packageId, songId, paymentMethod, phoneNumber } = req.body;

    const promotionPackage = PROMOTION_PACKAGES[packageId];
    if (!promotionPackage) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) {
      return res.status(403).json({ error: 'Artist profile required' });
    }

    // Verify the song exists AND belongs to this artist.
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    if (song.artist.toString() !== artist._id.toString()) {
      return res.status(403).json({ error: 'You can only promote your own songs' });
    }

    // Prevent duplicate active promotions of the same package on the
    // same song. Otherwise an artist could pay twice and only see one
    // effective promotion.
    const existingActive = await Promotion.findOne({
      song: songId,
      package: packageId,
      status: { $in: ['active', 'pending'] },
      endDate: { $gt: new Date() },
    });
    if (existingActive) {
      return res.status(400).json({
        error: 'This song already has an active or pending promotion for this package',
      });
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + promotionPackage.duration);

    if (paymentMethod === 'wallet') {
      // Atomic wallet debit + record creation in a transaction.
      let promotionRecord;
      let paymentRecord;

      await session.withTransaction(async () => {
        const debited = await Wallet.findOneAndUpdate(
          { user: req.user._id, balance: { $gte: promotionPackage.price } },
          { $inc: { balance: -promotionPackage.price }, $set: { updatedAt: new Date() } },
          { new: true, session }
        );
        if (!debited) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        const [payment] = await Payment.create(
          [{
            user: req.user._id,
            amount: promotionPackage.price,
            type: 'promotion',
            method: 'wallet',
            status: 'completed',
            completedAt: new Date(),
            metadata: { songId, packageId, artistId: artist._id },
          }],
          { session }
        );
        paymentRecord = payment;

        const [promotion] = await Promotion.create(
          [{
            artist: artist._id,
            song: songId,
            package: packageId,
            duration: promotionPackage.duration,
            startDate: new Date(),
            endDate,
            amount: promotionPackage.price,
            status: 'active', // paid → active immediately
            payment: payment._id,
          }],
          { session }
        );
        promotionRecord = promotion;
      });

      return res.json({
        message: 'Promotion purchased and active',
        promotion: promotionRecord,
        payment: paymentRecord,
      });
    }

    // Mobile money / other external payment path: stays pending until
    // webhook fires.
    const promotion = await Promotion.create({
      artist: artist._id,
      song: songId,
      package: packageId,
      duration: promotionPackage.duration,
      startDate: new Date(),
      endDate,
      amount: promotionPackage.price,
      status: 'pending',
    });

    const paymentResult = await paymentService.initiatePayment(
      req.user._id,
      promotionPackage.price,
      'promotion',
      paymentMethod,
      { phoneNumber, songId, packageId, promotionId: promotion._id }
    );

    res.json({
      message: 'Promotion purchase initiated. Complete payment to activate.',
      promotion,
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.payment?.reference,
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    console.error('purchasePromotion error:', err);
    res.status(500).json({ error: 'Failed to purchase promotion' });
  } finally {
    await session.endSession();
  }
};

// ============================================================
// GET /api/promotions/my                 (auth required)
// ============================================================
export const getMyPromotions = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) {
      return res.status(403).json({ error: 'Artist profile required' });
    }

    const { page, limit, skip } = parsePagination(req.query);

    const [promotions, total] = await Promise.all([
      Promotion.find({ artist: artist._id })
        .populate('song', 'title coverArt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Promotion.countDocuments({ artist: artist._id }),
    ]);

    res.json({
      promotions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getMyPromotions error:', err);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
};

// ============================================================
// GET /api/promotions/featured           (public)
// ============================================================
//
// FIX: Old code's `featured` object was missing the `playlist` package
// entirely — so an artist could buy a Playlist Placement and it would
// never appear in the featured content response. Added.
//
export const getFeaturedContent = async (req, res) => {
  try {
    const activePromotions = await Promotion.find({
      status: 'active',
      endDate: { $gt: new Date() },
    }).populate('song', 'title coverArt artist').populate({
      path: 'song',
      populate: { path: 'artist', select: 'stageName verified' },
    });

    const featured = {
      homepage:  activePromotions.filter((p) => p.package === 'homepage'),
      trending:  activePromotions.filter((p) => p.package === 'trending'),
      playlist:  activePromotions.filter((p) => p.package === 'playlist'),  // was missing
      sponsored: activePromotions.filter((p) => p.package === 'sponsored'),
    };

    res.json(featured);
  } catch (err) {
    console.error('getFeaturedContent error:', err);
    res.status(500).json({ error: 'Failed to fetch featured content' });
  }
};

// ============================================================
// POST /api/promotions/:promotionId/cancel   (auth required)
// ============================================================
//
// Note: Cancellation does NOT refund. Promotions are typically
// non-refundable (the placement is already running). If you want
// partial refunds based on time remaining, that's a separate flow
// — flagged with TODO for product discussion.
//
export const cancelPromotion = async (req, res) => {
  try {
    const { promotionId } = req.params;

    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    const artist = await Artist.findOne({ userId: req.user._id });
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && (!artist || promotion.artist.toString() !== artist._id.toString())) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (promotion.status === 'cancelled') {
      return res.json({ message: 'Promotion already cancelled', promotion });
    }

    promotion.status = 'cancelled';
    promotion.cancelledAt = new Date();
    await promotion.save();

    res.json({ message: 'Promotion cancelled', promotion });
  } catch (err) {
    console.error('cancelPromotion error:', err);
    res.status(500).json({ error: 'Failed to cancel promotion' });
  }
};
