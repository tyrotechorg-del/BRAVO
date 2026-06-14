// ============================================================
// PATCH for backend/src/models/Subscription.js
// ============================================================
//
// Adds 'listener_premium' to the type enum so the gating checks in
// downloadController/songController can actually work. See the batch 7
// README for full context.
//
// In Subscription.js, change ONE line:
//
//   type: {
//     type: String,
//     enum: ['artist_basic', 'artist_pro', 'artist_vip'],           // ← was this
//     enum: ['listener_premium', 'artist_basic', 'artist_pro', 'artist_vip'],  // ← change to this
//     required: true,
//   },
//
// Everything else stays the same. The schema is already permissive
// enough — no other field changes are required to support the new plan.
// ============================================================

// For convenience, here's the full updated Subscription.js. Drop it in
// over the batch 6 version.

import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      // FIX: added 'listener_premium' — see batch 7 README.
      enum: ['listener_premium', 'artist_basic', 'artist_pro', 'artist_vip'],
      required: true,
    },
    plan: {
      name: String,
      price: { type: Number, min: 0 },
      currency: { type: String, default: 'ZMW' },
      features: [String],
      uploadLimit: Number,
      duration: { type: Number, min: 1 },
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending'],
      default: 'pending',
    },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    autoRenew: { type: Boolean, default: false },
    paymentMethod: String,
    paymentReference: String,
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ user: 1, endDate: -1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

subscriptionSchema.methods.isActive = function () {
  return this.status === 'active' && this.endDate > new Date();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
