import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song'
    },
    playlist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Playlist'
    },
    comment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    type: {
        type: String,
        enum: ['song', 'playlist', 'comment'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

likeSchema.index({ user: 1, song: 1, type: 1 }, { unique: true });

const Like = mongoose.model('Like', likeSchema);
export default Like;