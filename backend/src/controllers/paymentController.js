import Payment from '../models/Payment.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Artist from '../models/Artist.js';
import pawaPayService from '../services/pawaPayService.js';
import notificationService from '../services/notificationService.js';

// Process Mobile Money Payment (Mock for now - replace with PawaPay)
const processMobileMoneyPayment = async (phoneNumber, amount, reference) => {
    console.log(`Processing Mobile Money payment: ${phoneNumber}, K${amount}, Ref: ${reference}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        success: true,
        transactionId: `TXN_${Date.now()}`,
        status: 'completed'
    };
};

// ==================== PAYMENT METHODS ====================

export const getPaymentMethods = async (req, res) => {
    try {
        const methods = [
            { id: 'mtn_money', name: 'MTN Mobile Money', enabled: true, minAmount: 5, maxAmount: 10000 },
            { id: 'airtel_money', name: 'Airtel Money', enabled: true, minAmount: 5, maxAmount: 10000 },
            { id: 'zamtel_kwacha', name: 'Zamtel Kwacha', enabled: true, minAmount: 5, maxAmount: 10000 },
            { id: 'wallet', name: 'Bravo Wallet', enabled: true, minAmount: 1, maxAmount: 50000 }
        ];
        
        res.json(methods);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
};

// ==================== INITIATE PAYMENT ====================

export const initiatePayment = async (req, res) => {
    try {
        const { amount, type, method, phoneNumber, metadata } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        
        if (!type || !method) {
            return res.status(400).json({ error: 'Payment type and method are required' });
        }
        
        const payment = new Payment({
            user: req.user._id,
            amount,
            type,
            method,
            status: 'pending',
            metadata: metadata || {},
            reference: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        
        await payment.save();
        
        let paymentResult;
        
        switch(method) {
            case 'mtn_money':
            case 'airtel_money':
            case 'zamtel_kwacha':
                if (!phoneNumber) {
                    return res.status(400).json({ error: 'Phone number required for mobile money' });
                }
                // Use PawaPay for real integration
                if (process.env.PAWAPAY_API_KEY) {
                    const provider = method.replace('_money', '');
                    paymentResult = await pawaPayService.initiatePayment(phoneNumber, amount, payment.reference, provider);
                } else {
                    // Mock for testing
                    paymentResult = await processMobileMoneyPayment(phoneNumber, amount, payment.reference);
                }
                break;
            case 'wallet':
                const wallet = await Wallet.findOne({ user: req.user._id });
                if (!wallet || wallet.balance < amount) {
                    return res.status(400).json({ error: 'Insufficient wallet balance' });
                }
                paymentResult = { success: true, status: 'completed' };
                break;
            default:
                return res.status(400).json({ error: 'Unsupported payment method' });
        }
        
        if (paymentResult.success) {
            payment.status = paymentResult.status === 'completed' ? 'completed' : 'pending';
            payment.metadata.transactionId = paymentResult.transactionId;
            await payment.save();
            
            if (payment.status === 'completed') {
                await processPayment(payment);
            }
            
            res.json({
                success: true,
                payment,
                paymentUrl: paymentResult.paymentUrl,
                reference: payment.reference,
                transactionId: paymentResult.transactionId
            });
        } else {
            payment.status = 'failed';
            await payment.save();
            res.status(400).json({ error: paymentResult.error || 'Payment failed' });
        }
    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({ error: 'Payment initiation failed' });
    }
};

// ==================== PAYMENT CALLBACK (Webhook) ====================

export const paymentCallback = async (req, res) => {
    try {
        const { provider } = req.params;
        const { reference, status, transactionId } = req.body;
        
        console.log(`Payment callback from ${provider}:`, { reference, status, transactionId });
        
        const payment = await Payment.findOne({ reference });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        if (status === 'completed' || status === 'success') {
            payment.status = 'completed';
            payment.completedAt = new Date();
            payment.metadata.transactionId = transactionId;
            await payment.save();
            
            await processPayment(payment);
        } else if (status === 'failed') {
            payment.status = 'failed';
            await payment.save();
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('Payment callback error:', error);
        res.status(500).json({ error: 'Callback processing failed' });
    }
};

// ==================== GET PAYMENT STATUS ====================

export const getPaymentStatus = async (req, res) => {
    try {
        const { reference } = req.params;
        
        const payment = await Payment.findOne({ reference, user: req.user._id });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        res.json({
            status: payment.status,
            amount: payment.amount,
            type: payment.type,
            reference: payment.reference,
            completedAt: payment.completedAt
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check payment status' });
    }
};

// ==================== GET PAYMENT HISTORY ====================

export const getPaymentHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const payments = await Payment.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Payment.countDocuments({ user: req.user._id });
        
        res.json({
            payments,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
};

// ==================== REFUND PAYMENT ====================

export const refundPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        // Only admin can refund
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        if (payment.status !== 'completed') {
            return res.status(400).json({ error: 'Payment cannot be refunded' });
        }
        
        payment.status = 'refunded';
        await payment.save();
        
        const wallet = await Wallet.findOne({ user: payment.user });
        if (wallet) {
            await wallet.addBalance(payment.amount, `Refund for ${payment.type}`);
        }
        
        const transaction = new Transaction({
            user: payment.user,
            payment: payment._id,
            amount: payment.amount,
            type: 'refund',
            status: 'completed',
            description: `Refund for ${payment.type}`
        });
        await transaction.save();
        
        await notificationService.createNotification(
            payment.user,
            'payment',
            'Payment Refunded',
            `Your payment of K${payment.amount} has been refunded.`,
            { paymentId: payment._id }
        );
        
        res.json({ message: 'Payment refunded', payment });
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: 'Failed to refund payment' });
    }
};

// ==================== PROCESS PAYMENT (Internal) ====================

export const processPayment = async (payment) => {
    try {
        const wallet = await Wallet.findOne({ user: payment.user });
        
        const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE) / 100;
        const platformCommission = payment.amount * commissionRate;
        const artistRevenue = payment.amount - platformCommission;
        
        payment.platformCommission = platformCommission;
        payment.artistRevenue = artistRevenue;
        await payment.save();
        
        const transaction = new Transaction({
            user: payment.user,
            payment: payment._id,
            amount: payment.amount,
            type: payment.type,
            status: 'completed',
            description: `${payment.type} payment`,
            reference: `TXN_${Date.now()}_${payment.reference}`
        });
        await transaction.save();
        
        switch(payment.type) {
            case 'subscription':
                const subscription = await Subscription.findById(payment.metadata.subscriptionId);
                if (subscription) {
                    subscription.status = 'active';
                    await subscription.save();
                    
                    if (subscription.type.startsWith('artist')) {
                        const artist = await Artist.findOne({ userId: payment.user });
                        if (artist) {
                            artist.subscriptionStatus = 'active';
                            artist.currentPlan = subscription.type.replace('artist_', '');
                            artist.subscriptionExpiry = subscription.endDate;
                            await artist.save();
                        }
                    }
                }
                break;
                
            case 'upload_credit':
                const artist = await Artist.findOne({ userId: payment.user });
                if (artist) {
                    const credits = payment.metadata.credits || 5;
                    artist.uploadCredits += credits;
                    artist.uploadCreditsExpiry = new Date();
                    artist.uploadCreditsExpiry.setDate(artist.uploadCreditsExpiry.getDate() + 30);
                    await artist.save();
                }
                break;
                
            case 'deposit':
                if (wallet) {
                    await wallet.addBalance(payment.amount, `Deposit via ${payment.method}`);
                }
                break;
                
            case 'song_purchase':
            case 'album_purchase':
                // Handle content purchase
                break;
        }
        
        // Send notification
        await notificationService.createNotification(
            payment.user,
            'payment',
            'Payment Successful',
            `Your ${payment.type} payment of K${payment.amount} was successful.`,
            { paymentId: payment._id }
        );
        
        return true;
    } catch (error) {
        console.error('Process payment error:', error);
        throw error;
    }
};

// ==================== INITIATE MOBILE MONEY (PawaPay) ====================

export const initiateMobileMoneyPayment = async (req, res) => {
    try {
        const { amount, provider, phoneNumber, type, metadata } = req.body;
        
        if (!amount || amount < 5) {
            return res.status(400).json({ error: 'Minimum payment is K5' });
        }
        
        const reference = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const payment = new Payment({
            user: req.user._id,
            amount,
            type: type || 'deposit',
            method: `${provider}_money`,
            status: 'pending',
            reference,
            metadata: { ...metadata, phoneNumber }
        });
        await payment.save();
        
        let result;
        
        if (process.env.PAWAPAY_API_KEY) {
            // Use PawaPay for real integration
            result = await pawaPayService.initiatePayment(phoneNumber, amount, reference, provider);
        } else {
            // Mock for testing
            result = await processMobileMoneyPayment(phoneNumber, amount, reference);
        }
        
        if (result.success) {
            payment.metadata.transactionId = result.transactionId;
            await payment.save();
            
            res.json({
                success: true,
                payment,
                transactionId: result.transactionId,
                status: result.status,
                paymentUrl: result.paymentUrl
            });
        } else {
            payment.status = 'failed';
            await payment.save();
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        console.error('Mobile money payment error:', error);
        res.status(500).json({ error: 'Payment initiation failed' });
    }
};

// ==================== PAWAPAY WEBHOOK HANDLER ====================

export const handlePawaPayWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        
        // Verify signature if needed
        // const isValid = verifyWebhookSignature(req.body, signature, process.env.PAWAPAY_SECRET_KEY);
        
        const { event, data } = req.body;
        
        if (event === 'payment.completed') {
            const payment = await Payment.findOne({ reference: data.reference });
            if (payment && payment.status === 'pending') {
                payment.status = 'completed';
                payment.completedAt = new Date();
                payment.metadata.transactionId = data.id;
                await payment.save();
                
                await processPayment(payment);
                
                await notificationService.createNotification(
                    payment.user,
                    'payment',
                    'Payment Successful',
                    `Your payment of K${payment.amount} was successful!`,
                    { paymentId: payment._id }
                );
            }
        } else if (event === 'payment.failed') {
            const payment = await Payment.findOne({ reference: data.reference });
            if (payment) {
                payment.status = 'failed';
                await payment.save();
            }
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};