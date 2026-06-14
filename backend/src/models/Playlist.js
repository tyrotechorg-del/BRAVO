import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Songs array — bounded by application logic (clients typically
    // don't add thousands per playlist, but the schema doesn't prevent it).
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],

    coverArt: {
      type: String,
      default: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300',
    },
    isPublic: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },

    // Embedded likes array — same caveat as Comment.likes. The Like
    // collection has `type: 'playlist'` entries that should be the
    // source of truth; the array is the legacy storage and grows
    // unbounded for popular playlists. Flagged for a refactor batch.
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    playCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

playlistSchema.index({ user: 1, createdAt: -1 });
playlistSchema.index({ isPublic: 1, isFeatured: 1 });

const Playlist = mongoose.model('Playlist', playlistSchema);
export default Playlist;
