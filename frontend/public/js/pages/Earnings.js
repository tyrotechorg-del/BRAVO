

class EarningsPage {
    constructor() {
        this.earnings = {
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            pendingWithdrawal: 0
        };
        this.transactions = [];
        this.minWithdrawal = 50;
        this.artistsAPI = new ArtistsAPI();
    }

    async render() {
        return `
            <div class="earnings-container">
                <h1>Earnings Overview</h1>

                <div class="dashboard-stats">
                    <div class="stat-card">
                        <h3>Available Balance</h3>
                        <div class="value" id="balance-value">—</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Earned</h3>
                        <div class="value" id="total-earned-value">—</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Withdrawn</h3>
                        <div class="value" id="total-withdrawn-value">—</div>
                    </div>
                    <div class="stat-card">
                        <h3>Pending Withdrawal</h3>
                        <div class="value" id="pending-value">—</div>
                    </div>
                </div>

                <div class="earnings-actions">
                    <button class="btn-primary" type="button" id="withdraw-btn" disabled>
                        <i class="fas fa-money-bill-wave"></i> Request Withdrawal
                    </button>
                    <button class="btn-outline" type="button" id="refresh-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                <div id="min-withdrawal-notice"></div>

                <div class="recent-transactions">
                    <h2>Recent Transactions</h2>
                    <div class="transactions-list" id="transactions-list">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in', 'warning');
            return;
        }

        await this._loadData();
        this._renderStats();
        this._renderTransactions();
        this._wireButtons();
    }

    async _loadData() {
        try {
            const result = await this.artistsAPI.getEarnings();
            if (result.success && result.data) {
                this.earnings = { ...this.earnings, ...result.data };
            }
        } catch (err) {
            console.error('Load earnings error:', err);
        }

        if (window.WalletAPI) {
            try {
                const walletAPI = new WalletAPI();
                const txResult = await walletAPI.getTransactions();
                const data = txResult?.success ? txResult.data : txResult;
                this.transactions = data?.transactions || [];
            } catch (err) {
                console.error('Load transactions error:', err);
            }
        }
    }

    _renderStats() {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = `K${Number(val || 0).toFixed(2)}`;
        };
        set('balance-value', this.earnings.balance);
        set('total-earned-value', this.earnings.totalEarned);
        set('total-withdrawn-value', this.earnings.totalWithdrawn);
        set('pending-value', this.earnings.pendingWithdrawal);

        // Enable withdraw button only above threshold
        const withdrawBtn = document.getElementById('withdraw-btn');
        if (withdrawBtn) {
            withdrawBtn.disabled = Number(this.earnings.balance || 0) < this.minWithdrawal;
        }

        // Min-withdrawal notice
        const notice = document.getElementById('min-withdrawal-notice');
        if (notice) {
            notice.innerHTML = Number(this.earnings.balance || 0) < this.minWithdrawal
                ? `<div class="warning-message"><i class="fas fa-info-circle"></i> Minimum withdrawal amount is K${this.minWithdrawal}</div>`
                : '';
        }
    }

    _renderTransactions() {
        const list = document.getElementById('transactions-list');
        if (!list) return;

        if (this.transactions.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No transactions yet</h3>
                    <p>Your earnings will appear here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = '';
        this.transactions.forEach(t => list.appendChild(this._buildTransactionItem(t)));
    }

    _buildTransactionItem(t) {
        const type = t.type || 'unknown';
        const isPositive = type === 'royalty' || type === 'earning' || type === 'deposit';
        const safeDesc = this._escapeHtml(t.description || type);
        const amount = Math.abs(Number(t.amount || 0)).toFixed(2);
        const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '';

        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="transaction-icon ${isPositive ? 'positive' : 'negative'}">
                <i class="fas ${isPositive ? 'fa-music' : 'fa-money-bill-wave'}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-title">${safeDesc}</div>
                <div class="transaction-date">${this._escapeHtml(date)}</div>
            </div>
            <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
                ${isPositive ? '+' : '-'} K${amount}
            </div>
        `;
        return item;
    }

    _wireButtons() {
        document.getElementById('withdraw-btn')?.addEventListener('click', () => this._showWithdrawModal());
        document.getElementById('refresh-btn')?.addEventListener('click', async () => {
            await this._loadData();
            this._renderStats();
            this._renderTransactions();
            Toast.show?.('Earnings refreshed', 'success');
        });
    }

    // Withdrawal modal
    _showWithdrawModal() {
        const balance = Number(this.earnings.balance || 0);
        if (balance < this.minWithdrawal) {
            Toast.show?.(`Minimum withdrawal is K${this.minWithdrawal}`, 'warning');
            return;
        }

        const handle = Modal.show({
            title: 'Request Withdrawal',
            content: `
                <form id="withdraw-form" novalidate>
                    <div class="form-group">
                        <label for="wd-amount">Amount (Kwacha)</label>
                        <input type="number" id="wd-amount" step="0.01" min="${this.minWithdrawal}" max="${balance}" required>
                        <small>Min: K${this.minWithdrawal}, Max: K${balance.toFixed(2)}</small>
                    </div>
                    <div class="form-group">
                        <label for="wd-method">Withdrawal Method</label>
                        <select id="wd-method" required>
                            <option value="mtn_money">MTN Mobile Money</option>
                            <option value="airtel_money">Airtel Money</option>
                            <option value="zamtel_kwacha">Zamtel Kwacha</option>
                            <option value="bank_transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <div class="form-group" id="wd-phone-group">
                        <label for="wd-phone">Phone Number</label>
                        <input type="tel" id="wd-phone" placeholder="0977123456" maxlength="13">
                        <small>Format: 097/096/095/077/076/075 + 7 digits</small>
                    </div>
                    <div class="form-group" id="wd-bank-group" style="display:none;">
                        <label for="wd-account-name">Account Name</label>
                        <input type="text" id="wd-account-name" maxlength="100">
                        <label for="wd-account-number" style="margin-top:8px;">Account Number</label>
                        <input type="text" id="wd-account-number" maxlength="30">
                        <label for="wd-bank-name" style="margin-top:8px;">Bank Name</label>
                        <input type="text" id="wd-bank-name" maxlength="100">
                    </div>
                    <div id="wd-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Submit Request', class: 'btn-primary', action: 'submit' }
            ]
        });

        // change listener never attached.
        requestAnimationFrame(() => {
            const methodSel = document.getElementById('wd-method');
            const phoneGroup = document.getElementById('wd-phone-group');
            const bankGroup = document.getElementById('wd-bank-group');

            if (methodSel) {
                methodSel.addEventListener('change', () => {
                    const v = methodSel.value;
                    if (v === 'bank_transfer') {
                        if (phoneGroup) phoneGroup.style.display = 'none';
                        if (bankGroup) bankGroup.style.display = 'block';
                    } else {
                        if (phoneGroup) phoneGroup.style.display = 'block';
                        if (bankGroup) bankGroup.style.display = 'none';
                    }
                });
            }

            const submitBtn = handle?.element?.querySelector('[data-action="submit"]');
            if (submitBtn) {
                submitBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await this._submitWithdrawal(handle);
                });
            }
        });
    }

    async _submitWithdrawal(handle) {
        const errorEl = document.getElementById('wd-error');
        errorEl.textContent = '';

        const amount = parseFloat(document.getElementById('wd-amount').value);
        const method = document.getElementById('wd-method').value;
        const balance = Number(this.earnings.balance || 0);

        if (!Number.isFinite(amount) || amount < this.minWithdrawal || amount > balance) {
            errorEl.textContent = `Amount must be between K${this.minWithdrawal} and K${balance.toFixed(2)}`;
            return;
        }

        let accountDetails;
        if (method === 'bank_transfer') {
            const accountName = document.getElementById('wd-account-name').value.trim();
            const accountNumber = document.getElementById('wd-account-number').value.trim();
            const bankName = document.getElementById('wd-bank-name').value.trim();
            if (!accountName || !accountNumber || !bankName) {
                errorEl.textContent = 'All bank fields are required';
                return;
            }
            accountDetails = { accountName, accountNumber, bankName };
        } else {
            const phoneNumber = document.getElementById('wd-phone').value.trim();
            if (!this._isValidZambiaPhone(phoneNumber)) {
                errorEl.textContent = 'Enter a valid Zambian mobile number';
                return;
            }
            accountDetails = { phoneNumber };
        }

        const submitBtn = handle?.element?.querySelector('[data-action="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        const result = await this.artistsAPI.requestWithdrawal(amount, method, accountDetails);

        if (!result.success) {
            errorEl.textContent = result.error || 'Failed to submit withdrawal';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Request';
            }
            return;
        }

        handle?.close?.();
        Toast.show?.('Withdrawal request submitted', 'success');

        // Refresh data instead of reloading the page
        await this._loadData();
        this._renderStats();
        this._renderTransactions();
    }

    _isValidZambiaPhone(phone) {
        // Accepts: 0977123456 / 097 712 3456 / +260977123456
        if (!phone) return false;
        const normalized = phone.replace(/\s|\-/g, '');
        return /^(\+?260|0)(9[567]|7[567])\d{7}$/.test(normalized);
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.EarningsPage = EarningsPage;
