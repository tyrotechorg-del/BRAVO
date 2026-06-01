import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    method: {
        type: String,
        enum: ['mtn_money', 'airtel_money', 'zamtel_kwacha', 'bank_transfer'],
        required: true
    },
    accountDetails: {
        phoneNumber: String,
        accountName: String,
        accountNumber: String,
        bankName: String,
        branchCode: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'processing'],
        default: 'pending'
    },
    transactionReference: String,
    processedAt: Date,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectionReason: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;