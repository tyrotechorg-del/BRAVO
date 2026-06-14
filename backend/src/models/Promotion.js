import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema(
  {
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
    },
    song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
    album: { type: mongoose.Schema.Types.ObjectId, ref: 'Album' },
    package: {
      type: String,
      enum: ['homepage', 'trending', 'playlist', 'sponsored'],
      required: true,
    },
    duration: { type: Number, required: true, min: 1 }, // days
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 }, // FIX: was unbounded
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending'],
      default: 'pending',
    },
    impressions: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    cancelledAt: Date,
  },
  { timestamps: true }
);

// For the `getFeaturedContent` query: find active promotions per package.
promotionSchema.index({ status: 1, endDate: 1 });
promotionSchema.index({ artist: 1, createdAt: -1 });
promotionSchema.index({ song: 1, package: 1, status: 1 }); // for duplicate-promotion check

const Promotion = mongoose.model('Promotion', promotionSchema);
export default Promotion;
