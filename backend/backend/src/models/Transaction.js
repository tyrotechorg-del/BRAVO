import mongoose from 'mongoose';
import crypto from 'crypto';

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    amount: {
      type: Number,
      required: true,
      // FIX: was unbounded. Transactions can represent credits and debits;
      // we don't enforce sign here because some flows record negative
      // amounts intentionally (e.g., for adjustments). But zero is never
      // valid — a no-op transaction is just noise.
      validate: {
        validator: (v) => Number.isFinite(v) && v !== 0,
        message: 'Transaction amount must be non-zero and finite',
      },
    },
    type: {
      type: String,
      enum: [
        'subscription',
        'upload_credit',
        'royalty',
        'withdrawal',
        'promotion',
        'purchase',
        'deposit',
        'refund',
        'song_purchase',
        'album_purchase',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    description: { type: String, maxlength: 500 },
    metadata: mongoose.Schema.Types.Mixed,
    reference: { type: String, unique: true },
    completedAt: Date,
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ payment: 1 });

transactionSchema.pre('save', function (next) {
  if (!this.reference) {
    // FIX: same predictable-reference issue as Payment.
    const random = crypto.randomBytes(8).toString('hex');
    this.reference = `TXN-${Date.now()}-${random}`;
  }
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
