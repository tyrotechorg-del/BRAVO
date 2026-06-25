import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ['mtn_money', 'airtel_money', 'zamtel_kwacha', 'bank_transfer'],
      required: true,
    },
    accountDetails: {
      phoneNumber: String,
      accountName: String,
      accountNumber: String,
      bankName: String,
      branchCode: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processing'],
      default: 'pending',
    },
    transactionReference: String,
    processedAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
  },
  { timestamps: true }
);

// Queries: user history, admin pending-list.
withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;
