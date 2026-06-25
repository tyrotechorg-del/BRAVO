import Subscription from '../models/Subscription.js';
import Artist from '../models/Artist.js';
import notificationService from './notificationService.js';

// ============================================================
// Plans — source of truth for what's purchasable
// ============================================================
//
// FIX: listener_premium is now defined here. The download/stream
// controllers check `hasActiveSubscription(userId, 'listener_premium')`
// to gate premium content — but the Subscription model's `type` enum
// previously didn't include 'listener_premium', so the check could
// never return true and premium content was effectively
// admin-only-by-accident.
//
// IMPORTANT: For this to actually work end-to-end, Subscription.js
// (model) must include 'listener_premium' in the `type` enum. See the
// patch file in this batch.
//
const PLANS = {
  listener_premium: {
    name: 'Premium Listener',
    price: 25,
    features: [
      'Ad-free listening',
      'Premium song downloads',
      'High-quality streaming',
      'Unlimited skips',
    ],
    uploadLimit: 0,
    duration: 30,
  },
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
    features: [
      'Verified Badge',
      'Homepage Promotion',
      'Unlimited Uploads',
      'Monetization',
      '24/7 Priority Support',
    ],
    uploadLimit: -1,
    duration: 30,
  },
};

class SubscriptionService {
  getPlans() {
    return PLANS;
  }

  getPlan(planId) {
    return PLANS[planId] || null;
  }

  /**
   * Create a pending subscription.
   *
   * The subscription is `pending` until payment completes. The payment
   * flow (via paymentService.processPayment) flips it to 'active' when
   * the webhook fires.
   */
  async createSubscription(userId, planId, paymentMethod) {
    const plan = PLANS[planId];
    if (!plan) throw new Error('Invalid plan');

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    const subscription = await Subscription.create({
      user: userId,
      type: planId,
      plan: {
        name: plan.name,
        price: plan.price,
        currency: 'ZMW',
        features: plan.features,
        uploadLimit: plan.uploadLimit,
        duration: plan.duration,
      },
      status: 'pending',
      startDate,
      endDate,
      paymentMethod,
    });

    return subscription;
  }

  /**
   * Atomically activate a subscription. Replaces the original
   * findById -> mutate -> save pattern (race-prone if two webhooks
   * arrive concurrently for the same subscription).
   */
  async activateSubscription(subscriptionId) {
    const subscription = await Subscription.findOneAndUpdate(
      { _id: subscriptionId, status: { $ne: 'active' } },
      { $set: { status: 'active' } },
      { new: true }
    );

    if (!subscription) {
      // Already active (or doesn't exist). Return current state
      // without re-running side effects — idempotent by design.
      return Subscription.findById(subscriptionId);
    }

    // For artist plans, update the artist's flags atomically.
    if (subscription.type.startsWith('artist_')) {
      await Artist.findOneAndUpdate(
        { userId: subscription.user },
        {
          $set: {
            subscriptionStatus: 'active',
            currentPlan: subscription.type.replace('artist_', ''),
            subscriptionExpiry: subscription.endDate,
          },
        }
      );
    }

    // Notification is best-effort.
    notificationService
      .createNotification(
        subscription.user,
        'subscription',
        'Subscription Activated',
        `Your ${subscription.plan.name} is now active!`,
        { subscriptionId: subscription._id }
      )
      .catch((err) => console.error('Notification failed:', err.message));

    return subscription;
  }

  /**
   * Cancel a subscription. The user keeps access until endDate; autoRenew
   * is turned off so it won't auto-bill.
   */
  async cancelSubscription(subscriptionId) {
    const subscription = await Subscription.findOneAndUpdate(
      { _id: subscriptionId, status: 'active' },
      { $set: { status: 'cancelled', autoRenew: false } },
      { new: true }
    );

    if (!subscription) {
      throw new Error('Subscription not found or already inactive');
    }

    // Note: don't immediately downgrade the artist's plan. They paid
    // for access until endDate. A scheduled job should mark plans
    // expired when endDate < now.
    notificationService
      .createNotification(
        subscription.user,
        'subscription',
        'Subscription Cancelled',
        `Your ${subscription.plan.name} has been cancelled. Access continues until ${subscription.endDate.toLocaleDateString()}.`,
        { subscriptionId: subscription._id }
      )
      .catch((err) => console.error('Notification failed:', err.message));

    return subscription;
  }

  /**
   * Check whether the user has an active subscription, optionally of a
   * specific type.
   *
   * NOTE: For `hasActiveSubscription(userId, 'listener_premium')` to ever
   * return true, the Subscription model's `type` enum must include
   * 'listener_premium'. See Subscription.patch.js in this batch.
   */
  async hasActiveSubscription(userId, type = null) {
    const query = {
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() },
    };
    if (type) query.type = type;

    const subscription = await Subscription.findOne(query).select('_id');
    return Boolean(subscription);
  }

  async getActiveSubscription(userId) {
    return Subscription.findOne({
      user: userId,
      status: 'active',
      endDate: { $gt: new Date() },
    });
  }

  /**
   * Convenience helper for the artist-dashboard view.
   * Reads denormalized flags off the Artist document.
   */
  async getArtistSubscription(userId) {
    const artist = await Artist.findOne({ userId }).select(
      'subscriptionStatus currentPlan subscriptionExpiry uploadCredits uploadCreditsExpiry'
    );
    if (!artist) return null;

    return {
      status: artist.subscriptionStatus,
      plan: artist.currentPlan,
      expiryDate: artist.subscriptionExpiry,
      uploadCredits: artist.uploadCredits,
      uploadCreditsExpiry: artist.uploadCreditsExpiry,
    };
  }
}

export default new SubscriptionService();
