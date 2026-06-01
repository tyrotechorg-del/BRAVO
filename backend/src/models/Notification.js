import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'comment', 'follow', 'subscription', 'withdrawal', 'admin', 'artist_update', 'share', 'welcome'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;