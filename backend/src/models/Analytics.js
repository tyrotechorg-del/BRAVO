import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null for guests
  song:   { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist' },
  album:  { type: mongoose.Schema.Types.ObjectId, ref: 'Album' },

  action: {
    type: String,
    enum: ['stream', 'download', 'like', 'share', 'search', 'view'],
    required: true,
  },
  deviceInfo: {
    deviceType: String,
    browser: String,
    os: String,
  },
  location: {
    country: String,
    city: String,
    ip: String,
  },
  referrer: String,
  duration: { type: Number, min: 0 },
  timestamp: { type: Date, default: Date.now },
});

// Pre-existing indexes preserved + a new compound index that matches
// the artist-dashboard daily-streams aggregation in artistController.
// The aggregation does:
//   $match: { song: { $in: artistSongs }, action: 'stream', timestamp: {$gte}}
//   $group: by day-of-timestamp
// So the ideal index is (song, action, timestamp) which already exists.
// We keep all original indexes for backward compat.
analyticsSchema.index({ timestamp: -1 });
analyticsSchema.index({ song: 1, action: 1, timestamp: -1 });
analyticsSchema.index({ artist: 1, timestamp: -1 });
analyticsSchema.index({ user: 1, timestamp: -1 });
// New: for the "active users last 30 days" engagement query.
analyticsSchema.index({ timestamp: -1, user: 1 });

// TTL: auto-purge raw analytics events older than 1 year. Aggregations
// for long-term trends should run as scheduled jobs that write summaries
// to a separate collection. Without this TTL the analytics collection
// grows unbounded.
analyticsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const Analytics = mongoose.model('Analytics', analyticsSchema);
export default Analytics;
