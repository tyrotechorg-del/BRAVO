import mongoose from 'mongoose';
import { GENRES, normalizeGenre } from './Genres.js';

const albumSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist',
      required: true,
    },
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
    coverArt: { type: String, required: true },
    description: { type: String, maxlength: 2000 },

    // Genre uses the canonical list. Same normalisation hook as Song/Artist.
    genre: { type: String, enum: GENRES, required: true },

    releaseDate: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['album', 'ep', 'single', 'compilation'],
      default: 'album',
    },
    // FIX: bounded at 0.
    price: { type: Number, default: 0, min: 0 },
    isPremium: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    totalStreams: { type: Number, default: 0, min: 0 },
    totalDownloads: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

albumSchema.index({ status: 1, createdAt: -1 });
albumSchema.index({ artist: 1, status: 1 });

albumSchema.pre('save', function (next) {
  if (this.genre) {
    const normalized = normalizeGenre(this.genre);
    if (normalized) this.genre = normalized;
  }
  next();
});

const Album = mongoose.model('Album', albumSchema);
export default Album;
