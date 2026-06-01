import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['artist_basic', 'artist_pro', 'artist_vip'],
    required: true
  },
  plan: {
    name: String,
    price: Number,
    currency: {
      type: String,
      default: 'ZMW'
    },
    features: [String],
    uploadLimit: Number,
    duration: Number
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  autoRenew: {
    type: Boolean,
    default: false
  },
  paymentMethod: String,
  paymentReference: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && this.endDate > new Date();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;