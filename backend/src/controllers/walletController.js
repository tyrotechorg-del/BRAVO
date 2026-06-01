import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import Withdrawal from '../models/Withdrawal.js';

export const getBalance = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user: req.user._id });
        
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
            await wallet.save();
            return res.json({ balance: 0, totalEarned: 0, totalWithdrawn: 0 });
        }
        
        res.json({
            balance: wallet.balance,
            totalEarned: wallet.totalEarned,
            totalWithdrawn: wallet.totalWithdrawn,
            pendingWithdrawal: wallet.pendingWithdrawal,
            currency: wallet.currency
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
};

export const getTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const query = { user: req.user._id };
        
        if (type) query.type = type;
        
        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Transaction.countDocuments(query);
        
        res.json({
            transactions,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

export const deposit = async (req, res) => {
    try {
        const { amount, method, phoneNumber } = req.body;
        
        if (amount < 5) {
            return res.status(400).json({ error: 'Minimum deposit is K5' });
        }
        
        const PaymentService = await import('../services/paymentService.js');
        const result = await PaymentService.default.initiatePayment(
            req.user._id,
            amount,
            'deposit',
            method,
            { phoneNumber }
        );
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Deposit failed' });
    }
};

export const withdraw = async (req, res) => {
    try {
        const { amount, method, accountDetails } = req.body;
        
        const wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT) || 50;
        if (amount < minWithdrawal) {
            return res.status(400).json({ error: `Minimum withdrawal is K${minWithdrawal}` });
        }
        
        const withdrawal = new Withdrawal({
            user: req.user._id,
            amount,
            method,
            accountDetails,
            status: 'pending'
        });
        
        await withdrawal.save();
        
        wallet.pendingWithdrawal += amount;
        wallet.balance -= amount;
        await wallet.save();
        
        const transaction = new Transaction({
            user: req.user._id,
            amount,
            type: 'withdrawal',
            status: 'pending',
            description: `Withdrawal request of K${amount}`
        });
        await transaction.save();
        
        res.json({
            message: 'Withdrawal request submitted',
            withdrawal,
            transaction
        });
    } catch (error) {
        res.status(500).json({ error: 'Withdrawal failed' });
    }
};

export const getEarnings = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ user: req.user._id });
        
        const earnings = await Transaction.aggregate([
            {
                $match: {
                    user: req.user._id,
                    type: 'royalty',
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);
        
        res.json({
            balance: wallet?.balance || 0,
            totalEarned: wallet?.totalEarned || 0,
            monthlyEarnings: earnings
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
};