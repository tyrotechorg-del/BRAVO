import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: { type: String, required: true, maxlength: 100 },
    target: { type: mongoose.Schema.Types.ObjectId },
    targetType: String,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
  },
  // No `timestamps: true` here — we use the manual `timestamp` field
  // because it's named differently from Mongoose's createdAt/updatedAt
  // convention and downstream code may rely on the singular form.
);

adminLogSchema.index({ timestamp: -1 });
adminLogSchema.index({ admin: 1, timestamp: -1 });
adminLogSchema.index({ action: 1, timestamp: -1 });

// TTL: keep audit logs for 2 years. Long enough for compliance, short
// enough that the collection doesn't grow forever. Adjust per your
// jurisdiction's audit-retention requirements.
adminLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

const AdminLog = mongoose.model('AdminLog', adminLogSchema);
export default AdminLog;
