import mongoose from 'mongoose';

const downloadSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
    quality: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    ip: String,
    userAgent: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

downloadSchema.index({ user: 1, createdAt: -1 });
downloadSchema.index({ song: 1, createdAt: -1 });

const Download = mongoose.model('Download', downloadSchema);
export default Download;