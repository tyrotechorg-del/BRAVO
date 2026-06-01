import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'ZMW'
  },
  type: {
    type: String,
    enum: ['subscription', 'upload_credit', 'promotion', 'song_purchase', 'album_purchase', 'withdrawal', 'deposit'],
    required: true
  },
  method: {
    type: String,
    enum: ['mtn_money', 'airtel_money', 'zamtel_kwacha', 'card', 'bank_transfer', 'wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  reference: {
    type: String,
    unique: true
  },
  metadata: mongoose.Schema.Types.Mixed,
  platformCommission: Number,
  artistRevenue: Number,
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

paymentSchema.pre('save', function(next) {
  if (!this.reference) {
    this.reference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;