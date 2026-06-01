import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 500
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    songs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song'
    }],
    coverArt: {
        type: String,
        default: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    playCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Playlist = mongoose.model('Playlist', playlistSchema);
export default Playlist;