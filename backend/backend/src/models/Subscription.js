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
      enum: ['listener_premium', 'artist_basic', 'artist_pro', 'artist_vip'],
      required: true,
    },
    plan: {
      name: String,
      price: { type: Number, min: 0 },
      currency: { type: String, default: 'ZMW' },
      features: [String],
      uploadLimit: Number, // -1 means unlimited; explicit semantics
      duration: { type: Number, min: 1 }, // days
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
subscriptionSchema.index({ status: 1, endDate: 1 }); // for the "find expiring subs" cron

subscriptionSchema.methods.isActive = function () {
  return this.status === 'active' && this.endDate > new Date();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
