import Payment from '../models/Payment.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';

class PaymentService {
    async initiatePayment(userId, amount, type, method, metadata) {
        const payment = new Payment({
            user: userId,
            amount,
            type,
            method,
            status: 'pending',
            metadata
        });
        
        await payment.save();
        
        // For mobile money simulation
        if (method === 'mtn_money' || method === 'airtel_money' || method === 'zamtel_kwacha') {
            // Simulate payment processing
            setTimeout(async () => {
                payment.status = 'completed';
                payment.completedAt = new Date();
                await payment.save();
                await this.processPayment(payment);
            }, 3000);
        }
        
        return { 
            payment, 
            paymentUrl: `https://${method.split('_')[0]}.com/pay/${payment.reference}` 
        };
    }

    async processPayment(payment) {
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
            
            if (payment.type === 'deposit') {
                await wallet.addBalance(payment.amount);
            }
            
            return true;
        } catch (error) {
            console.error('Process payment error:', error);
            throw error;
        }
    }

    async checkPaymentStatus(reference) {
        const payment = await Payment.findOne({ reference });
        if (!payment) {
            throw new Error('Payment not found');
        }
        return payment;
    }
}

export default new PaymentService();