import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Subscription from '../models/Subscription.js';
import Artist from '../models/Artist.js';
import pawaPayService from './pawaPayService.js';
import notificationService from './notificationService.js';
import SystemSettings from '../models/SystemSettings.js';

class PaymentService {
  /**
   * Initiate a payment.
   *
   * MAJOR FIX — the original code had this for mobile money:
   *
   *   setTimeout(async () => {
   *     payment.status = 'completed';
   *     await payment.save();
   *     await this.processPayment(payment);
   *   }, 3000);
   *
   * Three seconds after any mobile-money payment was initiated, the
   * service auto-completed it — without any actual money changing hands.
   * Any subscriber-tier feature (deposit, subscription, promotion) was
   * effectively free if you used a mobile-money method.
   *
   * The fix:
   *   - Mobile-money payments route through pawaPayService and stay
   *     'pending' until the provider's webhook fires.
   *   - Wallet payments do an atomic balance debit and complete inline.
   *   - Other methods leave the payment 'pending' and return the
   *     payment record so the caller can handle the next step.
   */
  async initiatePayment(userId, amount, type, method, metadata = {}) {
    // Basic input validation. The controllers also validate, but
    // paymentService is called from multiple places — defence in depth.
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Invalid amount');
    }

    const payment = await Payment.create({
      user: userId,
      amount: numAmount,
      type,
      method,
      status: 'pending',
      metadata,
    });

    // Mobile money: hand off to pawaPayService. The payment stays
    // 'pending' until the provider's webhook fires (handled by
    // paymentController.handlePawaPayWebhook).
    if (method === 'mtn_money' || method === 'airtel_money' || method === 'zamtel_kwacha') {
      const provider = method.split('_')[0]; // 'mtn' | 'airtel' | 'zamtel'
      const phoneNumber = metadata.phoneNumber;

      if (!phoneNumber) {
        await Payment.findByIdAndDelete(payment._id);
        throw new Error('phoneNumber is required for mobile money payments');
      }

      const result = await pawaPayService.initiatePayment(
        phoneNumber,
        numAmount,
        payment.reference,
        provider
      );

      if (!result.success) {
        payment.status = 'failed';
        await payment.save();
        throw new Error(result.error || 'Mobile money payment initiation failed');
      }

      payment.metadata = { ...payment.metadata, transactionId: result.transactionId };
      await payment.save();

      return {
        payment,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
        reference: payment.reference,
      };
    }

    // Wallet: atomic debit. If insufficient, the update returns null
    // and we abort.
    if (method === 'wallet') {
      const debited = await Wallet.findOneAndUpdate(
        { user: userId, balance: { $gte: numAmount } },
        { $inc: { balance: -numAmount } },
        { new: true }
      );

      if (!debited) {
        await Payment.findByIdAndDelete(payment._id);
        throw new Error('Insufficient wallet balance');
      }

      payment.status = 'completed';
      payment.completedAt = new Date();
      payment.metadata = { ...payment.metadata, transactionId: `WALLET_${payment._id}` };
      await payment.save();

      await this.processPayment(payment);

      return {
        payment,
        paymentUrl: null,
        transactionId: payment.metadata.transactionId,
        reference: payment.reference,
      };
    }

    // Other methods (card, bank_transfer): leave pending. The caller
    // is responsible for completing the payment via its own flow.
    return {
      payment,
      paymentUrl: null,
      reference: payment.reference,
    };
  }

  /**
   * Process a completed payment — wallet credit, subscription
   * activation, artist upload credits, etc. Wrapped in a MongoDB
   * transaction so all side effects either all succeed or all roll
   * back.
   *
   * This mirrors `paymentController.processPayment` (batch 4) — moving
   * the canonical implementation here so subscriptionController.webhook
   * and paymentController can both call it without duplicating logic.
   *
   * Called automatically by `initiatePayment` for wallet payments, and
   * by webhook handlers when an external payment completes.
   */
  async processPayment(payment) {
    if (payment.status !== 'completed') {
      throw new Error('processPayment requires a completed payment');
    }

    // Commission rate: try SystemSettings first, fall back to env, then
    // to a 10% default. NaN guard is critical — without it, an unset
    // env produces `parseFloat(undefined)/100 = NaN`, and `amount * NaN`
    // makes platformCommission and artistRevenue both NaN. Then the
    // artist gets `amount - NaN = NaN` ZMW credited.
    let commissionRate;
    try {
      const settings = await SystemSettings.getSettings();
      commissionRate = settings.platformCommission / 100;
    } catch {
      const envRate = Number(process.env.PLATFORM_COMMISSION_RATE);
      commissionRate = (Number.isFinite(envRate) ? envRate : 10) / 100;
    }

    const platformCommission = Math.round(payment.amount * commissionRate * 100) / 100;
    const artistRevenue = Math.round((payment.amount - platformCommission) * 100) / 100;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        payment.platformCommission = platformCommission;
        payment.artistRevenue = artistRevenue;
        await payment.save({ session });

        await Transaction.create(
          [{
            user: payment.user,
            payment: payment._id,
            amount: payment.amount,
            type: payment.type,
            status: 'completed',
            description: `${payment.type} payment`,
            // Reference uses the Payment.reference + a TXN prefix.
            // The Transaction model's pre-save hook also generates one
            // if missing, so this is just for readability.
            reference: `TXN-${payment.reference}`,
            completedAt: new Date(),
          }],
          { session }
        );

        switch (payment.type) {
          case 'subscription': {
            if (!payment.metadata?.subscriptionId) break;
            const subscription = await Subscription.findById(
              payment.metadata.subscriptionId
            ).session(session);
            if (subscription) {
              // For renewals, extend the endDate. For new subs, leave it.
              if (payment.metadata.isRenewal) {
                const baseDate =
                  subscription.endDate > new Date() ? subscription.endDate : new Date();
                const newEnd = new Date(baseDate);
                newEnd.setDate(newEnd.getDate() + (subscription.plan?.duration || 30));
                subscription.endDate = newEnd;
              }
              subscription.status = 'active';
              await subscription.save({ session });

              // For artist plans, update the artist's flags.
              if (subscription.type.startsWith('artist_')) {
                const artist = await Artist.findOne({ userId: subscription.user }).session(session);
                if (artist) {
                  artist.subscriptionStatus = 'active';
                  artist.currentPlan = subscription.type.replace('artist_', '');
                  artist.subscriptionExpiry = subscription.endDate;
                  await artist.save({ session });
                }
              }
            }
            break;
          }

          case 'upload_credit': {
            const artist = await Artist.findOne({ userId: payment.user }).session(session);
            if (artist) {
              const credits = payment.metadata?.credits || 5;
              const expiry = new Date();
              expiry.setDate(expiry.getDate() + 30);
              // Atomic increment — was instance-method addBalance pattern.
              await Artist.findByIdAndUpdate(
                artist._id,
                {
                  $inc: { uploadCredits: credits },
                  $set: { uploadCreditsExpiry: expiry },
                },
                { session }
              );
            }
            break;
          }

          case 'deposit': {
            await Wallet.findOneAndUpdate(
              { user: payment.user },
              {
                $inc: { balance: payment.amount, totalEarned: payment.amount },
                $setOnInsert: { user: payment.user },
              },
              { upsert: true, session }
            );
            break;
          }

          // song_purchase / album_purchase: entitlement is recorded via
          // the Payment.status='completed' field, which other controllers
          // check directly. No additional side effect needed.
          case 'song_purchase':
          case 'album_purchase':
          case 'promotion':
            break;
        }
      });

      // Best-effort notification outside the transaction.
      notificationService
        .createNotification(
          payment.user,
          'payment',
          'Payment Successful',
          `Your ${payment.type} payment of K${payment.amount} was successful.`,
          { paymentId: payment._id }
        )
        .catch((err) => console.error('Notification failed:', err.message));

      return true;
    } catch (err) {
      console.error('processPayment error:', err);
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async checkPaymentStatus(reference) {
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      throw new Error('Payment not found');
    }
    return payment;
  }
}

export default new PaymentService();
