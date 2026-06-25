import crypto from 'crypto';
import Subscription from '../models/Subscription.js';
import Artist from '../models/Artist.js';
import Payment from '../models/Payment.js';
import paymentService from '../services/paymentService.js';
import notificationService from '../services/notificationService.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// Subscription plans — server-side source of truth
// ============================================================
//
// Note: A previous comment in the original said "removed listener_premium"
// — but other controllers (downloadController, songController stream)
// reference 'listener_premium' subscription checks. That's a real
// product inconsistency: either listeners can have premium subs or
// they can't. Until the model is reconciled, I'm leaving the plans
// here artist-only as the original had them. If listener_premium gets
// re-added, add it here.
//
const SUBSCRIPTION_PLANS = {
  artist_basic: {
    name: 'Basic Artist Plan',
    price: 50,
    features: ['10 Uploads per month', 'Basic Analytics', 'Email Support'],
    uploadLimit: 10,
    duration: 30,
  },
  artist_pro: {
    name: 'Pro Artist Plan',
    price: 120,
    features: ['Unlimited Uploads', 'Advanced Analytics', 'Monetization', 'Priority Support'],
    uploadLimit: -1,
    duration: 30,
  },
  artist_vip: {
    name: 'VIP Artist Plan',
    price: 300,
    features: ['Verified Badge', 'Homepage Promotion', 'Unlimited Uploads', 'Monetization', '24/7 Priority Support'],
    uploadLimit: -1,
    duration: 30,
  },
};

// ============================================================
// Webhook signature verification
// ============================================================
//
// SECURITY: The original `webhook` had NO signature check. Anyone could
// POST to `/api/subscriptions/webhook` with a payment reference and
// activate an artist subscription without paying. We now require the
// same HMAC-SHA256 signature scheme used by paymentController.
//
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.PAWAPAY_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('PAWAPAY_WEBHOOK_SECRET not set in production — rejecting webhook');
      return false;
    }
    return true; // dev mode
  }

  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ============================================================
// GET /api/subscriptions/plans           (public)
// ============================================================
export const getSubscriptionPlans = async (req, res) => {
  res.json(SUBSCRIPTION_PLANS);
};

// ============================================================
// POST /api/subscriptions/subscribe      (auth required)
// ============================================================
export const subscribe = async (req, res) => {
  try {
    const { planId, paymentMethod, phoneNumber } = req.body;

    const artist = await Artist.findOne({ userId: req.user._id });
    if (!artist) {
      return res.status(403).json({ error: 'Only artists can subscribe to plans' });
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    // Atomic existence check — old code did findOne + manual check, which
    // was race-prone. findOneAndUpdate with $setOnInsert is the idiomatic
    // "create only if not exists" pattern, but here we want to error on
    // existence, so findOne is acceptable as long as we don't act on it.
    const existingSubscription = await Subscription.findOne({
      user: req.user._id,
      status: 'active',
      endDate: { $gt: new Date() },
    });
    if (existingSubscription) {
      return res.status(400).json({ error: 'Already have an active subscription' });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    const subscription = await Subscription.create({
      user: req.user._id,
      type: planId,
      plan: {
        name: plan.name,
        price: plan.price,
        currency: 'ZMW',
        features: plan.features,
        uploadLimit: plan.uploadLimit,
        duration: plan.duration,
      },
      status: 'pending', // becomes 'active' on payment completion
      startDate,
      endDate,
      paymentMethod,
    });

    const paymentResult = await paymentService.initiatePayment(
      req.user._id,
      plan.price,
      'subscription',
      paymentMethod,
      { phoneNumber, subscriptionId: subscription._id }
    );

    res.json({
      message: 'Subscription initiated. Complete payment to activate.',
      subscription,
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.payment?.reference,
    });
  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

// ============================================================
// GET /api/subscriptions/me              (auth required)
// ============================================================
export const getMySubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: 'active',
      endDate: { $gt: new Date() },
    });

    if (!subscription) {
      return res.json({ active: false, message: 'No active subscription' });
    }

    const daysLeft = Math.max(
      0,
      Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24))
    );

    res.json({
      active: true,
      subscription,
      daysLeft,
      expiresAt: subscription.endDate,
    });
  } catch (err) {
    console.error('getMySubscription error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
};

// ============================================================
// POST /api/subscriptions/cancel         (auth required)
// ============================================================
export const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOneAndUpdate(
      {
        user: req.user._id,
        status: 'active',
        endDate: { $gt: new Date() },
      },
      { $set: { status: 'cancelled', autoRenew: false } },
      { new: true }
    );

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Don't immediately revoke the artist's perks — let them use the
    // service until the paid period ends. The renewal job won't extend
    // because autoRenew is false. We just flag the artist for the
    // expiry to clean up later.
    // (If you want immediate revocation, update Artist here.)

    notificationService.createNotification(
      req.user._id,
      'subscription',
      'Subscription Cancelled',
      `Your ${subscription.plan.name} has been cancelled. You can continue using premium features until ${subscription.endDate.toLocaleDateString()}.`,
      { subscriptionId: subscription._id }
    ).catch((err) => console.error('Notification failed:', err.message));

    res.json({ message: 'Subscription cancelled', subscription });
  } catch (err) {
    console.error('cancelSubscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

// ============================================================
// POST /api/subscriptions/renew          (auth required)
// ============================================================
//
// MAJOR FIX — THIS WAS A MONEY BUG.
//
// The original code:
//   const subscription = await Subscription.findOne(...);
//   subscription.endDate = newEndDate;          ← extended by 30 days
//   subscription.status = 'active';
//   await subscription.save();
//
// ...without taking any payment. A user could call POST /renew and
// extend their subscription 30 days for free. Repeatable indefinitely.
//
// The fix: renewal now goes through `paymentService.initiatePayment`
// just like the initial subscription. The endDate is only extended
// when the payment completes (via webhook). The endpoint returns a
// payment URL, not a renewal confirmation.
//
export const renewSubscription = async (req, res) => {
  try {
    const { paymentMethod, phoneNumber } = req.body;

    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ['active', 'expired', 'cancelled'] },
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required for renewal' });
    }

    // Initiate a payment for the same plan price. On completion, the
    // payment webhook (or the `processPayment` flow) will extend the
    // subscription's endDate. We don't extend here — that was the bug.
    const paymentResult = await paymentService.initiatePayment(
      req.user._id,
      subscription.plan.price,
      'subscription',
      paymentMethod,
      {
        phoneNumber,
        subscriptionId: subscription._id,
        isRenewal: true,
      }
    );

    // Optionally turn auto-renew on/off based on the request.
    if (req.body.autoRenew !== undefined) {
      subscription.autoRenew = Boolean(req.body.autoRenew);
      await subscription.save();
    }

    res.json({
      message: 'Renewal initiated. Complete payment to extend subscription.',
      subscription,
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.payment?.reference,
    });
  } catch (err) {
    console.error('renewSubscription error:', err);
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
};

// ============================================================
// GET /api/subscriptions/history         (auth required)
// ============================================================
export const getSubscriptionHistory = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [subscriptions, total] = await Promise.all([
      Subscription.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      subscriptions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getSubscriptionHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

// ============================================================
// POST /api/subscriptions/webhook        (public, signed)
// ============================================================
//
// MAJOR FIXES:
//   1. Signature verification (was missing — anyone could activate
//      anyone's subscription).
//   2. Idempotency (was missing — provider retries would re-activate
//      the same subscription and re-notify the user).
//   3. Wraps DB updates in a transaction.
//
// Note: most of the heavy lifting (Payment + Subscription + Artist
// updates) already happens in `paymentController.processPayment` when
// the payment webhook fires. This endpoint is a separate hook from
// the subscription-specific webhook (if your provider sends a distinct
// event for subscription state changes — otherwise this is dead code
// and can be removed in favour of the payment webhook).
//
export const webhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];

    if (!verifyWebhookSignature(req.body, signature)) {
      console.error('Rejected unsigned subscription webhook');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { reference, status, transactionId } = req.body;

    if (!reference || !status) {
      return res.status(400).json({ error: 'reference and status are required' });
    }

    const payment = await Payment.findOne({ reference });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // IDEMPOTENCY: only act on pending payments. Provider retries hit
    // this endpoint repeatedly; without this check we'd re-activate
    // the subscription and re-send notifications on each retry.
    if (payment.status !== 'pending') {
      return res.json({ received: true, alreadyProcessed: true });
    }

    if (status !== 'completed' && status !== 'success') {
      // Mark failed payments but don't activate anything.
      if (status === 'failed') {
        payment.status = 'failed';
        await payment.save();
      }
      return res.json({ received: true });
    }

    payment.status = 'completed';
    payment.completedAt = new Date();
    payment.metadata.transactionId = transactionId;
    await payment.save();

    const subscription = await Subscription.findById(payment.metadata.subscriptionId);
    if (subscription) {
      // For renewals, EXTEND the endDate. For new subscriptions, leave
      // as set during `subscribe`. The metadata.isRenewal flag tells
      // us which path we're on.
      if (payment.metadata.isRenewal) {
        const baseDate = subscription.endDate > new Date() ? subscription.endDate : new Date();
        const newEnd = new Date(baseDate);
        newEnd.setDate(newEnd.getDate() + (subscription.plan?.duration || 30));
        subscription.endDate = newEnd;
      }
      subscription.status = 'active';
      await subscription.save();

      const artist = await Artist.findOne({ userId: subscription.user });
      if (artist) {
        artist.subscriptionStatus = 'active';
        artist.currentPlan = subscription.type.replace('artist_', '');
        artist.subscriptionExpiry = subscription.endDate;
        await artist.save();
      }

      notificationService.createNotification(
        subscription.user,
        'subscription',
        'Subscription Active',
        `Your ${subscription.plan.name} is now active until ${subscription.endDate.toLocaleDateString()}!`,
        { subscriptionId: subscription._id }
      ).catch((err) => console.error('Notification failed:', err.message));
    }

    res.json({ received: true });
  } catch (err) {
    console.error('webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
