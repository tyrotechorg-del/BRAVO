import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song'
    },
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Artist'
    },
    album: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Album'
    },
    action: {
        type: String,
        enum: ['stream', 'download', 'like', 'share', 'search', 'view'],
        required: true
    },
    deviceInfo: {
        deviceType: String,
        browser: String,
        os: String
    },
    location: {
        country: String,
        city: String,
        ip: String
    },
    referrer: String,
    duration: Number,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

analyticsSchema.index({ timestamp: -1 });
analyticsSchema.index({ song: 1, action: 1, timestamp: -1 });
analyticsSchema.index({ artist: 1, timestamp: -1 });
analyticsSchema.index({ user: 1, timestamp: -1 });

const Analytics = mongoose.model('Analytics', analyticsSchema);
export default Analytics;