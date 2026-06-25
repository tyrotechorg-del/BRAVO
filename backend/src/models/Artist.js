import mongoose from 'mongoose';
import { GENRES, normalizeGenre } from './Genres.js';

const artistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    stageName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 60,
    },

    // FIX: Was a 26-entry enum with mixed case (`'Hip Hop'` AND `'hip hop'`,
    // etc.) — duplicate values for the same logical genre. Now references
    // the canonical list and normalises incoming values to Title Case
    // via the pre-save hook below.
    genres: [{ type: String, enum: GENRES }],

    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },

    // ============ Counters ============
    monthlyListeners: { type: Number, default: 0, min: 0 },
    totalStreams: { type: Number, default: 0, min: 0 },
    totalDownloads: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    songsUploaded: { type: Number, default: 0, min: 0 },
    albumsUploaded: { type: Number, default: 0, min: 0 },

    // ============ Subscription ============
    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'suspended'],
      default: 'inactive',
    },
    currentPlan: {
      type: String,
      enum: ['basic', 'pro', 'vip', 'none'],
      default: 'none',
    },
    subscriptionExpiry: Date,

    // ============ Upload credits ============
    uploadCredits: { type: Number, default: 0, min: 0 },
    uploadCreditsExpiry: Date,
    uploadLimit: { type: Number, default: 0, min: 0 },

    promotionalBalance: { type: Number, default: 0, min: 0 },

    website: String,
    recordLabel: String,
    establishmentYear: Number,
    bannerImage: String,
    avatar: {
      type: String,
      default: 'images/bravo.png',
    },
    bio: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

// ============================================================
// Indexes
// ============================================================
artistSchema.index({ verified: 1, featured: 1 });
artistSchema.index({ subscriptionStatus: 1, subscriptionExpiry: 1 });

// ============================================================
// Pre-save: normalise genres to canonical Title Case
// ============================================================
// Drops anything that doesn't match a known genre rather than failing
// the whole save — the enum validator would already reject it, so this
// effectively means "valid genre or save fails". The normalisation
// matters for case insensitivity ('hip hop' becomes 'Hip Hop').
artistSchema.pre('save', function (next) {
  if (this.genres && Array.isArray(this.genres)) {
    this.genres = this.genres
      .map((g) => normalizeGenre(g))
      .filter(Boolean); // drop nulls
  }
  next();
});

// ============================================================
// Methods
// ============================================================

artistSchema.methods.canUpload = function () {
  if (this.subscriptionStatus === 'active' && this.subscriptionExpiry > new Date()) {
    return true;
  }
  if (this.uploadCredits > 0 && this.uploadCreditsExpiry > new Date()) {
    return true;
  }
  return false;
};

/**
 * Atomically consume one upload credit.
 *
 * FIX: The original method did:
 *   this.uploadCredits--;
 *   await this.save();
 * — a textbook read-modify-write race. Two concurrent uploads could
 * both pass the `if (this.uploadCredits > 0)` check and both decrement,
 * letting the artist upload one more song than they paid for.
 *
 * The fix uses `findOneAndUpdate` with `uploadCredits: { $gt: 0 }`
 * in the filter — only succeeds if the credit balance is positive.
 * Returns true if a credit was consumed, false otherwise.
 *
 * Note: subscription-based uploads (active sub) don't consume credits.
 * Callers should check `canUpload()` first, and only call this when
 * they need to debit the credit balance.
 */
artistSchema.methods.useUploadCredit = async function () {
  // If the artist has an active subscription, no credit is needed.
  if (this.subscriptionStatus === 'active' && this.subscriptionExpiry > new Date()) {
    return true;
  }

  const updated = await this.constructor.findOneAndUpdate(
    {
      _id: this._id,
      uploadCredits: { $gt: 0 },
      uploadCreditsExpiry: { $gt: new Date() },
    },
    { $inc: { uploadCredits: -1 } },
    { new: true }
  );

  if (!updated) return false;

  // Keep `this` in sync with the persisted state so the caller's
  // reference reflects the new credit count.
  this.uploadCredits = updated.uploadCredits;
  return true;
};

const Artist = mongoose.model('Artist', artistSchema);
export default Artist;
