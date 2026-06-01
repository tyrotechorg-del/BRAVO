import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  pendingWithdrawal: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'ZMW'
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

walletSchema.methods.addBalance = async function(amount, description) {
  this.balance += amount;
  this.totalEarned += amount;
  this.updatedAt = Date.now();
  await this.save();
};

walletSchema.methods.deductBalance = async function(amount, description) {
  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }
  this.balance -= amount;
  this.updatedAt = Date.now();
  await this.save();
};

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;