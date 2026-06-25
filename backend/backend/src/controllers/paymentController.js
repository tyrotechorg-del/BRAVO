import crypto from 'crypto';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Subscription from '../models/Subscription.js';
import Artist from '../models/Artist.js';
import pawaPayService from '../services/pawaPayService.js';
import notificationService from '../services/notificationService.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// Helpers
// ============================================================

/**
 * Generate a cryptographically random payment reference.
 *
 * Original used `Math.random().toString(36).substr(2,9)` which is
 * predictable and uses the deprecated .substr(). Payment references
 * should not be guessable — they're used to look up payments in
 * webhook handlers.
 */
function generatePaymentReference(prefix = 'PAY') {
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${Date.now()}_${random}`;
}

/**
 * Mock mobile money provider — only used when PAWAPAY_API_KEY is unset.
 * The original always returned success: true. Real testing requires the
 * ability to simulate failures, so we honour a MOCK_PAYMENT_FAIL_RATE env.
 */
const processMobileMoneyPayment = async (phoneNumber, amount, reference) => {
  console.log(`[MOCK] Processing Mobile Money: ${phoneNumber}, K${amount}, ref ${reference}`);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const failRate = Number(process.env.MOCK_PAYMENT_FAIL_RATE) || 0;
  if (Math.random() < failRate) {
    return { success: false, error: 'Mock payment failure for testing' };
  }

  return {
    success: true,
    transactionId: `MOCK_TXN_${Date.now()}`,
    status: 'completed',
  };
};

/**
 * Verify a PawaPay webhook signature.
 *
 * SECURITY: The original code had the verification commented out:
 *   // const isValid = verifyWebhookSignature(req.body, signature, secret);
 * This meant ANY POST to the webhook endpoint with a valid payment
 * reference would mark that payment as completed — i.e. anyone could
 * mark their own pending payments as completed without paying.
 *
 * Now actually runs. In dev (no secret configured) returns true so
 * local testing isn't blocked.
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.PAWAPAY_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('PAWAPAY_WEBHOOK_SECRET not set in production — rejecting webhook');
      return false;
    }
    return true; // dev mode — allow unsigned webhooks for testing
  }

  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
    .digest('hex');

  // Constant-time comparison to prevent timing attacks.
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ============================================================
// GET /api/payments/methods
// ============================================================
export const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      { id: 'mtn_money',     name: 'MTN Mobile Money',  enabled: true, minAmount: 5, maxAmount: 10000 },
      { id: 'airtel_money',  name: 'Airtel Money',      enabled: true, minAmount: 5, maxAmount: 10000 },
      { id: 'zamtel_kwacha', name: 'Zamtel Kwacha',     enabled: true, minAmount: 5, maxAmount: 10000 },
      { id: 'wallet',        name: 'Bravo Wallet',      enabled: true, minAmount: 1, maxAmount: 50000 },
    ];
    res.json(methods);
  } catch (err) {
    console.error('getPaymentMethods error:', err);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
};

// ============================================================
// POST /api/payments/initiate
// ============================================================
export const initiatePayment = async (req, res) => {
  try {
    const { amount, type, method, phoneNumber, metadata } = req.body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (numAmount > 50000) {
      return res.status(400).json({ error: 'Maximum payment is K50,000 per transaction' });
    }
    if (!type || !method) {
      return res.status(400).json({ error: 'Payment type and method are required' });
    }

    const payment = await Payment.create({
      user: req.user._id,
      amount: numAmount,
      type,
      method,
      status: 'pending',
      metadata: metadata || {},
      reference: generatePaymentReference('PAY'),
    });

    let paymentResult;

    switch (method) {
      case 'mtn_money':
      case 'airtel_money':
      case 'zamtel_kwacha': {
        if (!phoneNumber) {
          // Roll back the payment record — it was never useful.
          await Payment.findByIdAndDelete(payment._id);
          return res.status(400).json({ error: 'Phone number required for mobile money' });
        }
        if (process.env.PAWAPAY_API_KEY) {
          const provider = method.replace('_money', '').replace('_kwacha', '');
          paymentResult = await pawaPayService.initiatePayment(
            phoneNumber, numAmount, payment.reference, provider
          );
        } else {
          paymentResult = await processMobileMoneyPayment(phoneNumber, numAmount, payment.reference);
        }
        break;
      }

      case 'wallet': {
        // For wallet payments, atomically check and deduct the balance.
        // The old code did findOne -> check -> save which had a race
        // condition allowing double-spend.
        const updatedWallet = await Wallet.findOneAndUpdate(
          { user: req.user._id, balance: { $gte: numAmount } },
          { $inc: { balance: -numAmount }, $set: { updatedAt: new Date() } },
          { new: true }
        );
        if (!updatedWallet) {
          await Payment.findByIdAndDelete(payment._id);
          return res.status(400).json({ error: 'Insufficient wallet balance' });
        }
        paymentResult = { success: true, status: 'completed', transactionId: `WALLET_${payment._id}` };
        break;
      }

      default:
        await Payment.findByIdAndDelete(payment._id);
        return res.status(400).json({ error: 'Unsupported payment method' });
    }

    if (paymentResult?.success) {
      payment.status = paymentResult.status === 'completed' ? 'completed' : 'pending';
      payment.metadata.transactionId = paymentResult.transactionId;
      await payment.save();

      if (payment.status === 'completed') {
        await processPayment(payment);
      }

      return res.json({
        success: true,
        payment,
        paymentUrl: paymentResult.paymentUrl,
        reference: payment.reference,
        transactionId: paymentResult.transactionId,
      });
    }

    payment.status = 'failed';
    await payment.save();
    res.status(400).json({ error: paymentResult?.error || 'Payment failed' });
  } catch (err) {
    console.error('initiatePayment error:', err);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
};

// ============================================================
// POST /api/payments/callback/:provider
// ============================================================
//
// SECURITY: This endpoint receives webhook callbacks from payment
// providers. Without signature verification, ANYONE can hit this URL
// with a valid `reference` and mark a pending payment as completed —
// effectively getting a free subscription, wallet top-up, etc.
//
export const paymentCallback = async (req, res) => {
  try {
    const { provider } = req.params;
    const signature = req.headers['x-webhook-signature'];

    if (!verifyWebhookSignature(req.body, signature)) {
      console.error(`Rejected unsigned webhook from ${provider}`);
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

    // IDEMPOTENCY: providers retry webhooks. Without this check, the old
    // code would re-run processPayment on every retry, double-crediting
    // wallets and triggering duplicate notifications.
    if (payment.status !== 'pending') {
      return res.json({ received: true, alreadyProcessed: true });
    }

    if (status === 'completed' || status === 'success') {
      payment.status = 'completed';
      payment.completedAt = new Date();
      payment.metadata.transactionId = transactionId;
      await payment.save();

      await processPayment(payment);
    } else if (status === 'failed') {
      payment.status = 'failed';
      await payment.save();
    } else {
      return res.status(400).json({ error: `Unknown status: ${status}` });
    }

    res.json({ received: true });
  } catch (err) {
    console.error('paymentCallback error:', err);
    res.status(500).json({ error: 'Callback processing failed' });
  }
};

// ============================================================
// GET /api/payments/status/:reference
// ============================================================
export const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    const payment = await Payment.findOne({ reference, user: req.user._id });

    // SECURITY: return 404 (not 403) when the payment belongs to someone
    // else. 403 would confirm the reference exists, which is an info leak.
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      status: payment.status,
      amount: payment.amount,
      type: payment.type,
      reference: payment.reference,
      completedAt: payment.completedAt,
    });
  } catch (err) {
    console.error('getPaymentStatus error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
};

// ============================================================
// GET /api/payments/history
// ============================================================
export const getPaymentHistory = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [payments, total] = await Promise.all([
      Payment.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getPaymentHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
};

// ============================================================
// POST /api/payments/:paymentId/refund
// ============================================================
//
// TODO: For mobile-money payments this should call the provider's refund
// API, not just credit the in-app wallet. The current behaviour assumes
// the user is OK with wallet credit instead of money returned to their
// mobile money account. Confirm with product before going live.
//
export const refundPayment = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed payments can be refunded' });
    }

    payment.status = 'refunded';
    await payment.save();

    const wallet = await Wallet.findOne({ user: payment.user });
    if (wallet) {
      await wallet.addBalance(payment.amount, `Refund for ${payment.type}`);
    }

    await Transaction.create({
      user: payment.user,
      payment: payment._id,
      amount: payment.amount,
      type: 'refund',
      status: 'completed',
      description: `Refund for ${payment.type}`,
      reference: `RF_${payment._id}_${Date.now()}`,
    });

    await notificationService.createNotification(
      payment.user,
      'payment',
      'Payment Refunded',
      `Your payment of K${payment.amount} has been refunded.`,
      { paymentId: payment._id }
    );

    res.json({ message: 'Payment refunded', payment });
  } catch (err) {
    console.error('refundPayment error:', err);
    res.status(500).json({ error: 'Failed to refund payment' });
  }
};

// ============================================================
// Internal: processPayment — runs the side effects of a completed payment.
// Called from initiatePayment (wallet method) and paymentCallback (webhook).
// ============================================================
//
// This is wrapped in a MongoDB transaction so the Payment record, the
// Transaction record, the Wallet credit, the Subscription activation,
// and the Artist update either all succeed or all fail. The old code
// did these sequentially with no atomicity — a crash halfway through
// left the system in an inconsistent state (e.g. payment marked
// completed but wallet not credited).
//
export const processPayment = async (payment) => {
  // Commission rate: default to 10% if env var is missing/invalid.
  // The old code did `parseFloat(undefined) / 100` which produced NaN,
  // and `payment.amount * NaN` made commission and revenue both NaN.
  const commissionRateRaw = Number(process.env.PLATFORM_COMMISSION_RATE);
  const commissionRate = (Number.isFinite(commissionRateRaw) ? commissionRateRaw : 10) / 100;

  const platformCommission = Math.round(payment.amount * commissionRate * 100) / 100;
  const artistRevenue = Math.round((payment.amount - platformCommission) * 100) / 100;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      payment.platformCommission = platformCommission;
      payment.artistRevenue = artistRevenue;
      await payment.save({ session });

      await Transaction.create([{
        user: payment.user,
        payment: payment._id,
        amount: payment.amount,
        type: payment.type,
        status: 'completed',
        description: `${payment.type} payment`,
        reference: `TXN_${Date.now()}_${payment.reference}`,
      }], { session });

      switch (payment.type) {
        case 'subscription': {
          const subscription = await Subscription.findById(payment.metadata.subscriptionId).session(session);
          if (subscription) {
            subscription.status = 'active';
            await subscription.save({ session });

            if (subscription.type.startsWith('artist')) {
              const artist = await Artist.findOne({ userId: payment.user }).session(session);
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
            const credits = payment.metadata.credits || 5;
            artist.uploadCredits = (artist.uploadCredits || 0) + credits;
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);
            artist.uploadCreditsExpiry = expiry;
            await artist.save({ session });
          }
          break;
        }

        case 'deposit': {
          // Atomic balance update — avoid loading the document and calling
          // .addBalance() which is read-modify-write.
          await Wallet.findOneAndUpdate(
            { user: payment.user },
            {
              $inc: {
                balance: payment.amount,
                totalEarned: payment.amount,
              },
              $set: { updatedAt: new Date() },
            },
            { session, upsert: true }
          );
          break;
        }

        case 'song_purchase':
        case 'album_purchase':
          // Granting access is handled elsewhere — Payment.status=completed
          // is the source of truth for entitlement checks.
          break;
      }
    });

    // Notification is sent outside the transaction — it's best-effort
    // and shouldn't block payment processing if the notification service
    // is down.
    notificationService.createNotification(
      payment.user,
      'payment',
      'Payment Successful',
      `Your ${payment.type} payment of K${payment.amount} was successful.`,
      { paymentId: payment._id }
    ).catch((err) => console.error('Notification failed:', err.message));

    return true;
  } catch (err) {
    console.error('processPayment error:', err);
    throw err;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// POST /api/payments/mobile-money
// ============================================================
export const initiateMobileMoneyPayment = async (req, res) => {
  try {
    const { amount, provider, phoneNumber, type, metadata } = req.body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 5) {
      return res.status(400).json({ error: 'Minimum payment is K5' });
    }
    if (numAmount > 10000) {
      return res.status(400).json({ error: 'Maximum mobile money payment is K10,000' });
    }
    if (!provider || !phoneNumber) {
      return res.status(400).json({ error: 'Provider and phone number are required' });
    }

    const reference = generatePaymentReference('PAY');

    const payment = await Payment.create({
      user: req.user._id,
      amount: numAmount,
      type: type || 'deposit',
      method: `${provider}_money`,
      status: 'pending',
      reference,
      metadata: { ...(metadata || {}), phoneNumber },
    });

    const result = process.env.PAWAPAY_API_KEY
      ? await pawaPayService.initiatePayment(phoneNumber, numAmount, reference, provider)
      : await processMobileMoneyPayment(phoneNumber, numAmount, reference);

    if (result?.success) {
      payment.metadata.transactionId = result.transactionId;
      await payment.save();

      return res.json({
        success: true,
        payment,
        transactionId: result.transactionId,
        status: result.status,
        paymentUrl: result.paymentUrl,
      });
    }

    payment.status = 'failed';
    await payment.save();
    res.status(400).json({ error: result?.error || 'Payment failed' });
  } catch (err) {
    console.error('initiateMobileMoneyPayment error:', err);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
};

// ============================================================
// POST /api/payments/webhooks/pawapay
// ============================================================
export const handlePawaPayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];

    // SECURITY: actually verify the signature now (old code had this
    // line commented out).
    if (!verifyWebhookSignature(req.body, signature)) {
      console.error('Rejected unsigned PawaPay webhook');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { event, data } = req.body;
    if (!event || !data) {
      return res.status(400).json({ error: 'event and data are required' });
    }

    if (event === 'payment.completed') {
      const payment = await Payment.findOne({ reference: data.reference });

      // IDEMPOTENCY: only process pending payments. Webhooks retry on
      // their side, and the old code would re-process every retry.
      if (payment && payment.status === 'pending') {
        payment.status = 'completed';
        payment.completedAt = new Date();
        payment.metadata.transactionId = data.id;
        await payment.save();

        await processPayment(payment);
      }
    } else if (event === 'payment.failed') {
      const payment = await Payment.findOne({ reference: data.reference });
      if (payment && payment.status === 'pending') {
        payment.status = 'failed';
        await payment.save();
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('handlePawaPayWebhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
