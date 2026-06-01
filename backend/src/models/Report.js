import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['song', 'comment', 'user', 'album'],
        required: true
    },
    contentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    description: String,
    status: {
        type: String,
        enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
        default: 'pending'
    },
    actionTaken: String,
    adminNotes: String,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Report = mongoose.model('Report', reportSchema);
export default Report;