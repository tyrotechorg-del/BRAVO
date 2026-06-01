/**
 * Subscriptions API Client
 */

class SubscriptionsAPI {
    constructor() {
        this.apiUrl = window.API_BASE_URL;
    }

    getToken() {
        return localStorage.getItem('bravo_token');
    }

    async getPlans() {
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SUBSCRIPTIONS}/plans`);
            return await response.json();
        } catch (error) {
            console.error('Get plans error:', error);
            return window.SUBSCRIPTION_PLANS;
        }
    }

    async subscribe(planId, paymentMethod, phoneNumber) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SUBSCRIPTIONS}/subscribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ planId, paymentMethod, phoneNumber })
            });
            return await response.json();
        } catch (error) {
            console.error('Subscribe error:', error);
            return { error: 'Failed to subscribe' };
        }
    }

    async getMySubscription() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SUBSCRIPTIONS}/my-subscription`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get subscription error:', error);
            return { active: false };
        }
    }

    async cancelSubscription() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SUBSCRIPTIONS}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Cancel subscription error:', error);
            return { error: 'Failed to cancel subscription' };
        }
    }

    async renewSubscription(autoRenew = false) {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SUBSCRIPTIONS}/renew`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ autoRenew })
            });
            return await response.json();
        } catch (error) {
            console.error('Renew subscription error:', error);
            return { error: 'Failed to renew subscription' };
        }
    }

    async getHistory() {
        try {
            const token = this.getToken();
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.SUBSCRIPTIONS}/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Get subscription history error:', error);
            return [];
        }
    }
}

window.SubscriptionsAPI = SubscriptionsAPI;