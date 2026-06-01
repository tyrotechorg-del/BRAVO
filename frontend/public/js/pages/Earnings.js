/**
 * Earnings Page for Artists
 */

class EarningsPage {
    constructor() {
        this.earnings = {
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            pendingWithdrawal: 0
        };
        this.transactions = [];
    }

    async render() {
        await this.loadData();
        
        return `
            <div class="earnings-container">
                <h1>Earnings Overview</h1>
                
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <h3>Available Balance</h3>
                        <div class="value">K${this.earnings.balance.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Earned</h3>
                        <div class="value">K${this.earnings.totalEarned.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Withdrawn</h3>
                        <div class="value">K${this.earnings.totalWithdrawn.toFixed(2)}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Pending Withdrawal</h3>
                        <div class="value">K${this.earnings.pendingWithdrawal.toFixed(2)}</div>
                    </div>
                </div>
                
                <div class="earnings-actions">
                    <button class="btn-primary" id="withdraw-btn" ${this.earnings.balance < 50 ? 'disabled' : ''}>
                        <i class="fas fa-money-bill-wave"></i> Request Withdrawal
                    </button>
                    <button class="btn-outline" id="refresh-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                
                ${this.earnings.balance < 50 ? '<div class="warning-message"><i class="fas fa-info-circle"></i> Minimum withdrawal amount is K50</div>' : ''}
                
                <div class="recent-transactions">
                    <h2>Recent Transactions</h2>
                    <div class="transactions-list">
                        ${this.renderTransactions()}
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const artistsAPI = new ArtistsAPI();
            const earnings = await artistsAPI.getEarnings();
            
            if (earnings) {
                this.earnings = earnings;
            }
            
            const walletAPI = new WalletAPI();
            const transactions = await walletAPI.getTransactions();
            this.transactions = transactions.transactions || [];
        } catch (error) {
            console.error('Load earnings error:', error);
        }
    }

    renderTransactions() {
        if (this.transactions.length === 0) {
            return '<div class="empty-state"><i class="fas fa-receipt"></i><h3>No transactions yet</h3><p>Your earnings will appear here</p></div>';
        }
        
        return this.transactions.map(t => `
            <div class="transaction-item">
                <div class="transaction-icon ${t.type === 'royalty' ? 'positive' : 'negative'}">
                    <i class="fas ${t.type === 'royalty' ? 'fa-music' : 'fa-money-bill-wave'}"></i>
                </div>
                <div class="transaction-info">
                    <div class="transaction-title">${this.escapeHtml(t.description || t.type)}</div>
                    <div class="transaction-date">${new Date(t.createdAt).toLocaleDateString()}</div>
                </div>
                <div class="transaction-amount ${t.type === 'royalty' ? 'positive' : 'negative'}">
                    ${t.type === 'royalty' ? '+' : '-'} K${Math.abs(t.amount).toFixed(2)}
                </div>
            </div>
        `).join('');
    }

    async afterRender() {
        const withdrawBtn = document.getElementById('withdraw-btn');
        const refreshBtn = document.getElementById('refresh-btn');
        
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => this.showWithdrawModal());
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadData();
                await this.render();
                this.afterRender();
                Toast.show('Earnings refreshed', 'success');
            });
        }
    }

    showWithdrawModal() {
        Modal.show({
            title: 'Request Withdrawal',
            content: `
                <form id="withdraw-form">
                    <div class="form-group">
                        <label>Amount (Kwacha)</label>
                        <input type="number" name="amount" step="0.01" min="50" max="${this.earnings.balance}" required>
                        <small>Min: K50, Max: K${this.earnings.balance.toFixed(2)}</small>
                    </div>
                    <div class="form-group">
                        <label>Withdrawal Method</label>
                        <select name="method" required>
                            <option value="mtn_money">MTN Mobile Money</option>
                            <option value="airtel_money">Airtel Money</option>
                            <option value="zamtel_kwacha">Zamtel Kwacha</option>
                            <option value="bank_transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <div class="form-group" id="phone-group">
                        <label>Phone Number</label>
                        <input type="tel" name="phoneNumber" placeholder="0977123456">
                    </div>
                    <div class="form-group" id="bank-group" style="display: none;">
                        <label>Bank Account Details</label>
                        <input type="text" name="accountName" placeholder="Account Name">
                        <input type="text" name="accountNumber" placeholder="Account Number">
                        <input type="text" name="bankName" placeholder="Bank Name">
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Submit Request', class: 'btn-primary', action: 'submit', onClick: async () => {
                    const form = document.getElementById('withdraw-form');
                    const amount = parseFloat(form.querySelector('[name="amount"]').value);
                    const method = form.querySelector('[name="method"]').value;
                    
                    let accountDetails = {};
                    if (method.includes('money')) {
                        accountDetails = { phoneNumber: form.querySelector('[name="phoneNumber"]').value };
                    } else {
                        accountDetails = {
                            accountName: form.querySelector('[name="accountName"]').value,
                            accountNumber: form.querySelector('[name="accountNumber"]').value,
                            bankName: form.querySelector('[name="bankName"]').value
                        };
                    }
                    
                    if (isNaN(amount) || amount < 50 || amount > this.earnings.balance) {
                        Toast.show('Invalid amount', 'error');
                        return;
                    }
                    
                    const artistsAPI = new ArtistsAPI();
                    const result = await artistsAPI.requestWithdrawal(amount, method, accountDetails);
                    
                    if (!result.error) {
                        Toast.show('Withdrawal request submitted!', 'success');
                        setTimeout(() => window.location.reload(), 2000);
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
        
        const methodSelect = document.querySelector('#withdraw-form select[name="method"]');
        const phoneGroup = document.getElementById('phone-group');
        const bankGroup = document.getElementById('bank-group');
        
        if (methodSelect) {
            methodSelect.addEventListener('change', (e) => {
                if (e.target.value.includes('money')) {
                    phoneGroup.style.display = 'block';
                    bankGroup.style.display = 'none';
                } else {
                    phoneGroup.style.display = 'none';
                    bankGroup.style.display = 'block';
                }
            });
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.EarningsPage = EarningsPage;