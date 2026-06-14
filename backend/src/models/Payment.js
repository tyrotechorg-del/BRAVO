import mongoose from 'mongoose';
import crypto from 'crypto';

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // FIX: amount must be > 0. The old schema had no min, accepting
    // negative payments (which would credit, not debit) and zero
    // (which would create no-op payment records that confuse accounting).
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: { type: String, default: 'ZMW' },
    type: {
      type: String,
      enum: [
        'subscription',
        'upload_credit',
        'promotion',
        'song_purchase',
        'album_purchase',
        'withdrawal',
        'deposit',
      ],
      required: true,
    },
    method: {
      type: String,
      enum: ['mtn_money', 'airtel_money', 'zamtel_kwacha', 'card', 'bank_transfer', 'wallet'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    reference: { type: String, unique: true },
    metadata: mongoose.Schema.Types.Mixed,
    platformCommission: { type: Number, min: 0 },
    artistRevenue: { type: Number, min: 0 },
    completedAt: Date,
  },
  { timestamps: true }
);

// ============================================================
// Indexes
// ============================================================
// `reference` already unique. Add indexes for the query patterns we
// observed in controllers:
paymentSchema.index({ user: 1, createdAt: -1 });           // history
paymentSchema.index({ user: 1, type: 1, status: 1 });      // "do I own this album?"
paymentSchema.index({ status: 1, createdAt: -1 });         // admin filters
paymentSchema.index({ 'metadata.albumId': 1, status: 1 }); // album-ownership lookup
paymentSchema.index({ 'metadata.subscriptionId': 1 });     // subscription webhook

// ============================================================
// Pre-save: cryptographic reference generation
// ============================================================
// FIX: Original used `Math.random().toString(36).substr(2, 9)` which is
//   (a) predictable — `Math.random()` is not cryptographic
//   (b) using the deprecated `.substr()`
// A predictable payment reference is a real concern because webhook
// handlers look up payments by reference; if an attacker can guess
// references, they can potentially trigger callbacks for someone else's
// payment.
//
// Now uses `crypto.randomBytes(8).toString('hex')` — 64 bits of unguessable
// randomness, plus the timestamp prefix for human-readability.
paymentSchema.pre('save', function (next) {
  if (!this.reference) {
    const random = crypto.randomBytes(8).toString('hex');
    this.reference = `PAY-${Date.now()}-${random}`;
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
