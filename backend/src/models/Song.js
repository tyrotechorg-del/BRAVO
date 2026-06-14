import mongoose from 'mongoose';
import { GENRES, normalizeGenre } from './Genres.js';

const songSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
    },
    album: { type: mongoose.Schema.Types.ObjectId, ref: 'Album' },
    featuredArtists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }],

    // FIX: Was a 26-entry enum with mixed case duplicates. Now references
    // the canonical list and normalises via pre-save hook.
    genre: { type: String, enum: GENRES, required: true },

    duration: { type: Number, required: true, min: 0 },
    audioUrl: { type: String, required: true },
    videoUrl: { type: String, default: null },
    videoFileId: String,
    audioFileId: String,
    coverArt: {
      type: String,
    },
    isVideo: { type: Boolean, default: false },

    qualityVersions: {
      low: String,
      medium: String,
      high: String,
    },
    waveform: String,

    // FIX: Price is now bounded — old schema accepted negatives.
    price: { type: Number, default: 0, min: 0 },
    isPremium: { type: Boolean, default: false },
    isExplicit: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'featured'],
      default: 'pending',
    },
    rejectionReason: String,

    // ============ Counters (all min: 0 — never go negative) ============
    playCount:     { type: Number, default: 0, min: 0 },
    downloadCount: { type: Number, default: 0, min: 0 },
    likeCount:     { type: Number, default: 0, min: 0 },
    commentCount:  { type: Number, default: 0, min: 0 },
    shareCount:    { type: Number, default: 0, min: 0 },
    revenue:       { type: Number, default: 0, min: 0 },

    releaseDate: { type: Date, default: Date.now },
    lyrics: { type: String, maxlength: 10000 },
    tags: [{ type: String, maxlength: 50 }],
    language: String,
    mood: String,
    bpm: { type: Number, min: 0, max: 999 },
    key: String,

    isPromoted: { type: Boolean, default: false },
    promotionExpiry: Date,
  },
  { timestamps: true }
);

// ============================================================
// Indexes
// ============================================================
// Text index for ReDoS-safe full-text search (proper alternative to
// regex search — searchController could be migrated to use $text in
// a future pass).
songSchema.index({ title: 'text', tags: 'text', genre: 'text', lyrics: 'text' }, { name: 'title_text_tags_text_genre_text' });

// Listing queries.
songSchema.index({ status: 1, createdAt: -1 });
songSchema.index({ status: 1, playCount: -1 });
songSchema.index({ artist: 1, status: 1 });
songSchema.index({ genre: 1, status: 1 });
songSchema.index({ isVideo: 1, status: 1 });

// ============================================================
// Pre-save: normalize genre
// ============================================================
songSchema.pre('save', function (next) {
  if (this.genre) {
    const normalized = normalizeGenre(this.genre);
    if (normalized) this.genre = normalized;
  }
  next();
});

// ============================================================
// DEPRECATED methods (kept for backwards compatibility)
// ============================================================
//
// The original `incrementPlayCount` / `incrementDownloadCount` did
// `this.x++; save()` which is a read-modify-write race. Under
// concurrent load, two simultaneous plays would each read playCount=5,
// each set playCount=6, and one increment is lost.
//
// New code should use atomic operations directly:
//   Song.findByIdAndUpdate(songId, { $inc: { playCount: 1 } })
//
// These methods are kept (now atomic internally) so older code calling
// them doesn't break. The body uses findByIdAndUpdate which is atomic,
// so the race is fixed even when these are called.

songSchema.methods.incrementPlayCount = async function () {
  const updated = await this.constructor.findByIdAndUpdate(
    this._id,
    { $inc: { playCount: 1 } },
    { new: true }
  );
  if (updated) this.playCount = updated.playCount;
};

songSchema.methods.incrementDownloadCount = async function () {
  const updated = await this.constructor.findByIdAndUpdate(
    this._id,
    { $inc: { downloadCount: 1 } },
    { new: true }
  );
  if (updated) this.downloadCount = updated.downloadCount;
};

const Song = mongoose.model('Song', songSchema);
export default Song;
