import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    song:     { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
    playlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' },
    comment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    type: {
      type: String,
      enum: ['song', 'playlist', 'comment'],
      required: true,
    },
  },
  { timestamps: true }
);

// ============================================================
// Unique partial indexes — one per target type
// ============================================================
//
// FIX: The original schema had ONE unique index on `{user, song, type}`.
// That correctly prevented duplicate song-likes, but didn't protect
// against duplicate comment-likes or playlist-likes — because for a
// comment-like, the `song` field is null, and `{user, null, comment}`
// only matches duplicates that also have null song AND the same comment.
// In practice, the index worked for songs and was a no-op for the
// other two types.
//
// The fix: three separate UNIQUE PARTIAL indexes, one per type. Each
// uses `partialFilterExpression` so it only applies to documents of
// that type, avoiding null-collision issues. The E11000 catch in
// likeController.toggleLike now actually works for all three types.
likeSchema.index(
  { user: 1, song: 1 },
  { unique: true, partialFilterExpression: { type: 'song' } }
);
likeSchema.index(
  { user: 1, playlist: 1 },
  { unique: true, partialFilterExpression: { type: 'playlist' } }
);
likeSchema.index(
  { user: 1, comment: 1 },
  { unique: true, partialFilterExpression: { type: 'comment' } }
);

// For listing a user's likes by type.
likeSchema.index({ user: 1, type: 1, createdAt: -1 });

const Like = mongoose.model('Like', likeSchema);
export default Like;
