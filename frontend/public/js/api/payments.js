/**
 * Payments API Client
 */

class PaymentsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async initiatePayment(amount, type, method, phoneNumber, metadata = {}) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PAYMENTS}/initiate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount, type, method, phoneNumber, metadata })
            });
            return await response.json();
        } catch (error) {
            console.error('Initiate payment error:', error);
            return { error: 'Failed to initiate payment' };
        }
    }

    async getPaymentStatus(reference) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PAYMENTS}/status/${reference}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get payment status error:', error);
            return { error: 'Failed to get payment status' };
        }
    }

    async getHistory(page = 1, limit = 20) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PAYMENTS}/history?page=${page}&limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get payment history error:', error);
            return { payments: [], totalPages: 0, currentPage: 1, total: 0 };
        }
    }

    async getMethods() {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PAYMENTS}/methods`);
            return await response.json();
        } catch (error) {
            console.error('Get payment methods error:', error);
            return [];
        }
    }

    async refund(paymentId) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.PAYMENTS}/refund/${paymentId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Refund payment error:', error);
            return { error: 'Failed to refund payment' };
        }
    }
}

window.PaymentsAPI = PaymentsAPI;