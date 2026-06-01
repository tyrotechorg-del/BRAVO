/**
 * Wallet API Client
 */

class WalletAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async getBalance() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.WALLET}/balance`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get balance error:', error);
            return { balance: 0 };
        }
    }

    async getTransactions(page = 1, limit = 20) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.WALLET}/transactions?page=${page}&limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get transactions error:', error);
            return { transactions: [], totalPages: 0 };
        }
    }

    async deposit(amount, method, phoneNumber) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.WALLET}/deposit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount, method, phoneNumber })
            });
            return await response.json();
        } catch (error) {
            console.error('Deposit error:', error);
            return { error: 'Deposit failed' };
        }
    }

    async withdraw(amount, method, accountDetails) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.WALLET}/withdraw`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount, method, accountDetails })
            });
            return await response.json();
        } catch (error) {
            console.error('Withdraw error:', error);
            return { error: 'Withdrawal failed' };
        }
    }

    async getEarnings() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.WALLET}/earnings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get earnings error:', error);
            return { balance: 0, totalEarned: 0 };
        }
    }
}

window.WalletAPI = WalletAPI;