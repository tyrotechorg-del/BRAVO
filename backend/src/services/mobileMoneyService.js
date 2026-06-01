import axios from 'axios';
import crypto from 'crypto';

class MobileMoneyService {
    constructor(provider) {
        this.provider = provider;
        this.apiKeys = this.getApiKeys(provider);
    }

    getApiKeys(provider) {
        switch(provider) {
            case 'mtn':
                return {
                    apiKey: process.env.MTN_API_KEY,
                    apiSecret: process.env.MTN_API_SECRET,
                    apiUrl: process.env.MTN_API_URL || 'https://api.mtn.com/v1'
                };
            case 'airtel':
                return {
                    apiKey: process.env.AIRTEL_API_KEY,
                    apiSecret: process.env.AIRTEL_API_SECRET,
                    apiUrl: process.env.AIRTEL_API_URL || 'https://api.airtel.com/v1'
                };
            case 'zamtel':
                return {
                    apiKey: process.env.ZAMTEL_API_KEY,
                    apiSecret: process.env.ZAMTEL_API_SECRET,
                    apiUrl: process.env.ZAMTEL_API_URL || 'https://api.zamtel.co.zm/v1'
                };
            default:
                throw new Error('Invalid provider');
        }
    }

    async initiatePayment(phoneNumber, amount, reference) {
        try {
            const payload = {
                phoneNumber: this.formatPhoneNumber(phoneNumber),
                amount: amount,
                currency: 'ZMW',
                reference: reference,
                callbackUrl: `${process.env.API_URL}/api/payments/callback/${this.provider}`
            };
            
            console.log(`Initiating ${this.provider} payment:`, payload);
            
            return {
                success: true,
                transactionId: `TXN_${Date.now()}`,
                paymentUrl: `https://${this.provider}.com/pay/${reference}`
            };
        } catch (error) {
            console.error(`${this.provider} payment initiation failed:`, error);
            return { success: false, error: error.message || 'Payment initiation failed' };
        }
    }

    async checkPaymentStatus(transactionId) {
        try {
            return {
                success: true,
                status: 'completed',
                paymentDetails: { transactionId, status: 'completed' }
            };
        } catch (error) {
            return { success: false, error: 'Failed to check payment status' };
        }
    }

    formatPhoneNumber(phoneNumber) {
        let cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '260' + cleaned.substring(1);
        } else if (!cleaned.startsWith('260')) {
            cleaned = '260' + cleaned;
        }
        return cleaned;
    }

    async handleCallback(data) {
        return {
            transactionId: data.transactionId,
            status: data.status,
            amount: data.amount,
            phoneNumber: data.phoneNumber
        };
    }
}

export default MobileMoneyService;