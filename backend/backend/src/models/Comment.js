import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    content: {
      type: String,
      required: true,
      // FIX: was maxlength 500, but the controller (batch 3) enforces 2000.
      // Aligned to the same limit. Controller-level check is the primary
      // validator (with HTML escaping); schema is defence-in-depth.
      maxlength: 2000,
    },

    // KNOWN ISSUE: `likes` is an embedded array AND there's a Like
    // collection with type='comment'. The likeController writes to the
    // Like collection; commentController.likeComment writes to this array.
    // They drift apart. This is a real refactor (migrate all comment-like
    // operations to the Like collection, drop this array). Flagged for a
    // future batch — fixing it requires updating both controllers
    // consistently with a data migration.
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0, min: 0 }, // counter, atomically maintained

    // Same caveat applies to replies — could grow unbounded on a popular
    // comment. Pagination of replies is a future improvement.
    replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],

    isFlagged: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    flaggedAt: Date,
    flaggedReason: String,
  },
  { timestamps: true }
);

// Existing index + a few new ones for query patterns from controllers.
commentSchema.index({ song: 1, createdAt: -1 });
commentSchema.index({ song: 1, parentComment: 1, isDeleted: 1 });
commentSchema.index({ user: 1, createdAt: -1 }); // used by userController.deleteAccount
commentSchema.index({ isFlagged: 1, isDeleted: 1, flaggedAt: -1 }); // admin moderation queue

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
