import axios from 'axios';
import crypto from 'crypto';

class PawaPayService {
    constructor() {
        this.apiKey = process.env.PAWAPAY_API_KEY;
        this.secretKey = process.env.PAWAPAY_SECRET_KEY;
        this.baseUrl = process.env.PAWAPAY_ENV === 'production' 
            ? 'https://api.pawapay.io/v1'
            : 'https://sandbox.pawapay.io/v1';
        
        this.providers = {
            mtn: 'MTN_ZAMBIA',
            airtel: 'AIRTEL_ZAMBIA', 
            zamtel: 'ZAMTEL_ZAMBIA'
        };
    }

    getHeaders() {
        const timestamp = Date.now();
        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(`${timestamp}${this.apiKey}`)
            .digest('hex');

        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'Content-Type': 'application/json'
        };
    }

    async initiatePayment(phoneNumber, amount, reference, provider = 'mtn') {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            const providerCode = this.providers[provider];

            const payload = {
                amount: {
                    currency: 'ZMW',
                    value: amount
                },
                payer: {
                    type: 'CONSUMER',
                    address: formattedPhone,
                    providerCode: providerCode
                },
                payee: {
                    type: 'MERCHANT',
                    reference: process.env.PAWAPAY_MERCHANT_ID
                },
                reference: reference,
                description: `Bravo Music - Payment for ${reference}`,
                callbackUrl: `${process.env.API_URL}/api/payments/pawapay-callback`,
                expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            };

            const response = await axios.post(
                `${this.baseUrl}/payments`,
                payload,
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                transactionId: response.data.id,
                status: response.data.status,
                paymentUrl: response.data._links?.checkout?.href,
                requiresRedirect: response.data.requiresRedirect || false
            };
        } catch (error) {
            console.error('PawaPay initiation error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Payment initiation failed'
            };
        }
    }

    async checkPaymentStatus(transactionId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/payments/${transactionId}`,
                { headers: this.getHeaders() }
            );

            const statusMap = {
                'COMPLETED': 'completed',
                'PENDING': 'pending',
                'FAILED': 'failed',
                'EXPIRED': 'failed',
                'CANCELLED': 'failed'
            };

            return {
                success: true,
                status: statusMap[response.data.status] || 'pending',
                transaction: response.data,
                amount: response.data.amount?.value,
                phoneNumber: response.data.payer?.address
            };
        } catch (error) {
            console.error('Status check error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async initiateWithdrawal(phoneNumber, amount, reference, provider = 'mtn') {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            const providerCode = this.providers[provider];

            const payload = {
                amount: {
                    currency: 'ZMW',
                    value: amount
                },
                payee: {
                    type: 'CONSUMER',
                    address: formattedPhone,
                    providerCode: providerCode
                },
                payer: {
                    type: 'MERCHANT',
                    reference: process.env.PAWAPAY_MERCHANT_ID
                },
                reference: reference,
                description: `Bravo Music - Withdrawal for ${reference}`,
                callbackUrl: `${process.env.API_URL}/api/payments/withdrawal-callback`
            };

            const response = await axios.post(
                `${this.baseUrl}/payouts`,
                payload,
                { headers: this.getHeaders() }
            );

            return {
                success: true,
                transactionId: response.data.id,
                status: response.data.status
            };
        } catch (error) {
            console.error('Withdrawal error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.message || 'Withdrawal failed'
            };
        }
    }

    async getBalance() {
        try {
            const response = await axios.get(
                `${this.baseUrl}/balances`,
                { headers: this.getHeaders() }
            );
            return {
                success: true,
                balances: response.data
            };
        } catch (error) {
            return { success: false, error: error.message };
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

    async handleWebhook(payload, signature) {
        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', this.secretKey)
            .update(JSON.stringify(payload))
            .digest('hex');

        if (signature !== expectedSignature) {
            throw new Error('Invalid webhook signature');
        }

        const eventType = payload.event;
        const transactionId = payload.data?.id;

        switch (eventType) {
            case 'payment.completed':
                return {
                    type: 'payment',
                    status: 'completed',
                    transactionId,
                    amount: payload.data.amount.value,
                    reference: payload.data.reference
                };
            case 'payment.failed':
                return {
                    type: 'payment',
                    status: 'failed',
                    transactionId,
                    reference: payload.data.reference
                };
            case 'payout.completed':
                return {
                    type: 'withdrawal',
                    status: 'completed',
                    transactionId,
                    reference: payload.data.reference
                };
            default:
                return { type: 'unknown', status: 'ignored' };
        }
    }
}

export default new PawaPayService();