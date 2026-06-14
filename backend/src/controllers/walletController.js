import mongoose from 'mongoose';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Withdrawal from '../models/Withdrawal.js';
import paymentService from '../services/paymentService.js';
import { parsePagination } from '../utils/apiResponse.js';

// ============================================================
// GET /api/wallet/balance
// ============================================================
export const getBalance = async (req, res) => {
  try {
    // findOneAndUpdate with upsert creates the wallet atomically if missing.
    // Old code did findOne -> if (!wallet) -> create, which had a race
    // window where two simultaneous requests could both try to create
    // the wallet and one would hit a unique-index error.
    const wallet = await Wallet.findOneAndUpdate(
      { user: req.user._id },
      { $setOnInsert: { user: req.user._id } },
      { upsert: true, new: true }
    );

    res.json({
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      pendingWithdrawal: wallet.pendingWithdrawal,
      currency: wallet.currency,
    });
  } catch (err) {
    console.error('getBalance error:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
};

// ============================================================
// GET /api/wallet/transactions
// ============================================================
export const getTransactions = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { type } = req.query;

    const query = { user: req.user._id };

    // Whitelist allowed transaction types — don't accept arbitrary input
    // into a Mongo query.
    const ALLOWED_TYPES = [
      'deposit', 'withdrawal', 'royalty', 'refund', 'subscription',
      'song_purchase', 'album_purchase', 'upload_credit',
    ];
    if (type && ALLOWED_TYPES.includes(type)) {
      query.type = type;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(query),
    ]);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (err) {
    console.error('getTransactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// ============================================================
// POST /api/wallet/deposit
// ============================================================
export const deposit = async (req, res) => {
  try {
    const { amount, method, phoneNumber } = req.body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 5) {
      return res.status(400).json({ error: 'Minimum deposit is K5' });
    }
    if (numAmount > 50000) {
      return res.status(400).json({ error: 'Maximum deposit is K50,000 per transaction' });
    }
    if (!method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    // paymentService imported at top — old code did dynamic import().
    const result = await paymentService.initiatePayment(
      req.user._id,
      numAmount,
      'deposit',
      method,
      { phoneNumber }
    );

    res.json(result);
  } catch (err) {
    console.error('deposit error:', err);
    res.status(500).json({ error: 'Deposit failed' });
  }
};

// ============================================================
// POST /api/wallet/withdraw
// ============================================================
//
// SECURITY: The original code had a textbook race condition:
//
//   const wallet = await Wallet.findOne(...);    // read balance: K100
//   if (wallet.balance < amount) { ... }         // K100 >= K80 ✓
//   wallet.pendingWithdrawal += amount;          // local mutation
//   wallet.balance -= amount;                    // K100 - K80 = K20
//   await wallet.save();                         // persist
//
// Two simultaneous requests could both pass the balance check and both
// subtract, allowing a user to withdraw 2× their balance.
//
// The fix uses a conditional atomic update: `findOneAndUpdate` with a
// filter that includes the balance check. If the balance is no longer
// sufficient at write time, the update returns null and we reject.
//
export const withdraw = async (req, res) => {
  try {
    const { amount, method, accountDetails } = req.body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const minWithdrawal = Number(process.env.MIN_WITHDRAWAL_AMOUNT) || 50;
    if (numAmount < minWithdrawal) {
      return res.status(400).json({ error: `Minimum withdrawal is K${minWithdrawal}` });
    }

    if (!method || !accountDetails) {
      return res.status(400).json({ error: 'method and accountDetails are required' });
    }

    // Atomic balance check + deduction in a single MongoDB operation.
    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        user: req.user._id,
        balance: { $gte: numAmount }, // ← THIS is the race-safe check
      },
      {
        $inc: {
          balance: -numAmount,
          pendingWithdrawal: numAmount,
        },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // From here on, the wallet has been debited. Create the withdrawal
    // record and transaction. If creation fails (extremely rare), we'd
    // need a compensating refund — wrapped in try/catch with rollback.
    try {
      const withdrawal = await Withdrawal.create({
        user: req.user._id,
        amount: numAmount,
        method,
        accountDetails,
        status: 'pending',
      });

      const transaction = await Transaction.create({
        user: req.user._id,
        amount: numAmount,
        type: 'withdrawal',
        status: 'pending',
        description: `Withdrawal request of K${numAmount}`,
        reference: `WD_${withdrawal._id}`,
      });

      res.json({
        message: 'Withdrawal request submitted',
        withdrawal,
        transaction,
      });
    } catch (innerErr) {
      // Rollback the wallet debit since downstream records failed.
      await Wallet.findOneAndUpdate(
        { user: req.user._id },
        {
          $inc: {
            balance: numAmount,
            pendingWithdrawal: -numAmount,
          },
        }
      );
      throw innerErr;
    }
  } catch (err) {
    console.error('withdraw error:', err);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
};

// ============================================================
// GET /api/wallet/earnings
// ============================================================
export const getEarnings = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    // mongoose.Types.ObjectId is the explicit form. The old code passed
    // `req.user._id` directly which works in current Mongoose but isn't
    // guaranteed across versions and is harder to read.
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const earnings = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: 'royalty',
          status: 'completed',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 24 }, // last 2 years of monthly data
    ]);

    res.json({
      balance: wallet?.balance || 0,
      totalEarned: wallet?.totalEarned || 0,
      monthlyEarnings: earnings,
    });
  } catch (err) {
    console.error('getEarnings error:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};
