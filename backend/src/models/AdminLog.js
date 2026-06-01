import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true
    },
    target: {
        type: mongoose.Schema.Types.ObjectId
    },
    targetType: String,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

adminLogSchema.index({ timestamp: -1 });
adminLogSchema.index({ admin: 1, timestamp: -1 });

const AdminLog = mongoose.model('AdminLog', adminLogSchema);
export default AdminLog;