import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['song', 'comment', 'user', 'album'],
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    reason: { type: String, required: true, maxlength: 500 },
    description: { type: String, maxlength: 2000 },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
      default: 'pending',
    },
    actionTaken: String,
    adminNotes: { type: String, maxlength: 2000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

// ============================================================
// Unique index for report dedup
// ============================================================
// FIX: The commentController.reportComment (batch 3) checks for an
// existing report from the same reporter on the same content and
// returns "already reported" if found. That check has a race window
// — two concurrent reports could both pass the findOne and both
// insert. The unique index closes the race: the second insert fails
// with E11000, which the controller can catch.
reportSchema.index(
  { reporter: 1, type: 1, contentId: 1 },
  { unique: true }
);

// Admin moderation queue.
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);
export default Report;
