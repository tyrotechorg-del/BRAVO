import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    // FIX: All money fields are now min: 0. The old schema had no
    // validators — a bug elsewhere (or direct DB write) could push
    // balance negative, and the wallet would happily allow further
    // "withdrawals" that just deepen the deficit.
    balance:           { type: Number, default: 0, min: 0 },
    totalEarned:       { type: Number, default: 0, min: 0 },
    totalWithdrawn:    { type: Number, default: 0, min: 0 },
    pendingWithdrawal: { type: Number, default: 0, min: 0 },

    currency: { type: String, default: 'ZMW' },
    // NOTE: The `transactions` array was a denormalized list of all
    // transaction IDs. Unbounded growth — a user with 10k transactions
    // had a 10k-ObjectID array in this doc. Transactions are queried
    // via Transaction.find({ user }) anyway. Removing.
  },
  { timestamps: true }
);

walletSchema.index({ user: 1 }); // (uniqueness already creates one, but explicit)

// ============================================================
// Atomic balance operations
// ============================================================
//
// The original methods did:
//   this.balance += amount;
//   this.totalEarned += amount;
//   await this.save();
//
// This is a textbook read-modify-write race condition. Two simultaneous
// `addBalance(50)` calls could each read balance=100, each compute
// balance=150, each save 150 — one credit is lost.
//
// We've already migrated most controllers (batch 1, 4) to use
// `Wallet.findOneAndUpdate({ user }, { $inc: { ... } })` directly.
// These instance methods are kept for backwards compatibility with
// services we haven't reviewed yet — but they now use $inc internally
// so the race is fixed.

walletSchema.methods.addBalance = async function (amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive finite number');
  }

  const updated = await this.constructor.findByIdAndUpdate(
    this._id,
    {
      $inc: { balance: amount, totalEarned: amount },
    },
    { new: true }
  );

  if (updated) {
    this.balance = updated.balance;
    this.totalEarned = updated.totalEarned;
  }
  return this;
};

/**
 * Atomic balance deduction with insufficient-funds guard.
 *
 * The old code did:
 *   if (this.balance < amount) throw new Error('Insufficient balance');
 *   this.balance -= amount;
 *   await this.save();
 *
 * Two simultaneous deductBalance(80) on a wallet with balance=100 could
 * both pass the check and both subtract — letting the user spend 160.
 *
 * The fix: balance condition is in the filter. If insufficient, the
 * filter doesn't match and the update returns null.
 */
walletSchema.methods.deductBalance = async function (amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive finite number');
  }

  const updated = await this.constructor.findOneAndUpdate(
    { _id: this._id, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );

  if (!updated) {
    throw new Error('Insufficient balance');
  }

  this.balance = updated.balance;
  return this;
};

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
