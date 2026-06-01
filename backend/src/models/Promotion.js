import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Artist',
        required: true
    },
    song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song'
    },
    album: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Album'
    },
    package: {
        type: String,
        enum: ['homepage', 'trending', 'playlist', 'sponsored'],
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled', 'pending'],
        default: 'pending'
    },
    impressions: {
        type: Number,
        default: 0
    },
    clicks: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Promotion = mongoose.model('Promotion', promotionSchema);
export default Promotion;