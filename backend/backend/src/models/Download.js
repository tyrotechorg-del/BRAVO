import mongoose from 'mongoose';

const downloadSchema = new mongoose.Schema(
  {
    // FIX: was `required: true`. The download controller (batch 1) supports
    // guest downloads of non-premium songs and records them with user: null
    // and isGuest: true. The required validator was rejecting all guest writes.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Convenience flag so analytics queries don't have to do `{user: null}`.
    // Set automatically by the controller's recordDownload helper.
    isGuest: { type: Boolean, default: false, index: true },

    song:  { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
    album: { type: mongoose.Schema.Types.ObjectId, ref: 'Album' },

    quality: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

downloadSchema.index({ user: 1, createdAt: -1 });
downloadSchema.index({ song: 1, createdAt: -1 });
// Guest analytics (rate-limit forensics, etc.) — was new in batch 1.
downloadSchema.index({ isGuest: 1, ip: 1, createdAt: -1 });

const Download = mongoose.model('Download', downloadSchema);
export default Download;
