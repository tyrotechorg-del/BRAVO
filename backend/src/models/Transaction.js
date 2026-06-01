import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['subscription', 'upload_credit', 'royalty', 'withdrawal', 'promotion', 'purchase', 'deposit', 'refund'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    description: String,
    metadata: mongoose.Schema.Types.Mixed,
    reference: {
        type: String,
        unique: true
    },
    completedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

transactionSchema.pre('save', function(next) {
    if (!this.reference) {
        this.reference = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;