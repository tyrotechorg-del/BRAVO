/**
 * Wallet Page
 */

class WalletPage {
    constructor() {
        this.balance = 0;
        this.transactions = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.typeFilter = '';
        this.walletAPI = new WalletAPI();
        this.loading = true;
    }

    async render() {
        const role = window.authService?.getUser?.()?.role || 'listener';
        const canDeposit = true;   // anyone authenticated can deposit
        const canWithdraw = role === 'artist' || role === 'admin';
        const earningsLink = canWithdraw
            ? '<a href="#earnings" class="btn-outline" style="margin-left:8px;"><i class="fas fa-chart-line"></i> Earnings</a>'
            : '';

        return `
            <div class="wallet-page">
                <div class="page-header">
                    <h1><i class="fas fa-wallet"></i> My Wallet</h1>
                    <p>Top up your wallet to buy premium songs and albums.</p>
                </div>

                <div class="wallet-balance-card" style="background: linear-gradient(135deg, #6c63ff, #4d44ff); color:white; padding:24px; border-radius:12px; margin-bottom:24px;">
                    <div style="font-size:14px; opacity:0.8;">Available Balance</div>
                    <div id="wallet-balance" style="font-size:36px; font-weight:bold; margin: 8px 0;">K0.00</div>
                    <div style="display:flex; gap:8px; margin-top:16px;">
                        ${canDeposit ? '<button class="btn-light" type="button" id="wallet-deposit-btn"><i class="fas fa-plus"></i> Top Up</button>' : ''}
                        ${earningsLink}
                    </div>
                </div>

                <div class="transactions-section">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h2>Recent Transactions</h2>
                        <select id="wallet-type-filter">
                            <option value="">All Types</option>
                            <option value="deposit">Deposits</option>
                            <option value="purchase">Purchases</option>
                            <option value="royalty">Royalties</option>
                            <option value="withdrawal">Withdrawals</option>
                        </select>
                    </div>

                    <div id="wallet-transactions" aria-live="polite">
                        <div class="loading-container"><div class="spinner"></div></div>
                    </div>

                    <div class="pagination" id="wallet-pagination"></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in to view your wallet', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        this._wireButtons();
        await this._loadBalance();
        await this._loadTransactions();
        this._renderTransactions();
        this._renderPagination();
    }

    _wireButtons() {
        document.getElementById('wallet-deposit-btn')?.addEventListener('click', () => this._showDepositModal());
        document.getElementById('wallet-type-filter')?.addEventListener('change', async (e) => {
            this.typeFilter = e.target.value || '';
            this.currentPage = 1;
            await this._loadTransactions();
            this._renderTransactions();
            this._renderPagination();
        });
    }

    async _loadBalance() {
        const result = await this.walletAPI.getBalance();
        if (result.success) {
            this.balance = Number(result.data?.balance || 0);
        }
        const el = document.getElementById('wallet-balance');
        if (el) el.textContent = `K${this.balance.toFixed(2)}`;
    }

    async _loadTransactions() {
        const result = await this.walletAPI.getTransactions(this.currentPage, 20, this.typeFilter || null);
        if (result.success) {
            const data = result.data || {};
            this.transactions = data.transactions || [];
            this.totalPages = data.totalPages || 1;
        } else {
            this.transactions = [];
            this.totalPages = 1;
        }
        this.loading = false;
    }

    _renderTransactions() {
        const container = document.getElementById('wallet-transactions');
        if (!container) return;

        if (this.transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No transactions yet</h3>
                    <p>Top up your wallet or make a purchase to get started.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.transactions.forEach(t => container.appendChild(this._buildTxItem(t)));
    }

    _buildTxItem(t) {
        const type = String(t.type || 'unknown');
        const amount = Number(t.amount || 0);
        const isCredit = type === 'deposit' || type === 'royalty' || type === 'refund';
        const safeDesc = this._escapeHtml(t.description || this._typeLabel(type));
        const date = t.createdAt ? new Date(t.createdAt).toLocaleString() : '';
        const safeStatus = this._escapeHtml(t.status || 'completed');

        const icons = {
            deposit: 'fa-plus-circle',
            purchase: 'fa-shopping-cart',
            royalty: 'fa-music',
            withdrawal: 'fa-money-bill-wave',
            refund: 'fa-undo'
        };
        const icon = icons[type] || 'fa-circle';

        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid #eee;';
        item.innerHTML = `
            <div class="transaction-icon ${isCredit ? 'positive' : 'negative'}" style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:${isCredit ? '#2ed573' : '#ff4757'}; color:white;">
                <i class="fas ${icon}"></i>
            </div>
            <div class="transaction-info" style="flex:1;">
                <div class="transaction-title">${safeDesc}</div>
                <div class="transaction-date" style="font-size:12px; color:#888;">${this._escapeHtml(date)}</div>
            </div>
            <div style="text-align:right;">
                <div class="transaction-amount ${isCredit ? 'positive' : 'negative'}" style="font-weight:bold; color:${isCredit ? '#2ed573' : '#ff4757'};">
                    ${isCredit ? '+' : '-'} K${Math.abs(amount).toFixed(2)}
                </div>
                <div style="font-size:11px; color:#888;">${safeStatus}</div>
            </div>
        `;
        return item;
    }

    _renderPagination() {
        const container = document.getElementById('wallet-pagination');
        if (!container) return;
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        const prevDis = this.currentPage <= 1;
        const nextDis = this.currentPage >= this.totalPages;
        container.innerHTML = `
            <div class="pagination-controls" style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">
                <button class="page-btn" type="button" data-action="prev" ${prevDis ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>
                <button class="page-btn" type="button" data-action="next" ${nextDis ? 'disabled' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            if (btn.dataset.action === 'prev' && this.currentPage > 1) this.currentPage--;
            else if (btn.dataset.action === 'next' && this.currentPage < this.totalPages) this.currentPage++;
            else return;
            await this._loadTransactions();
            this._renderTransactions();
            this._renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
    }

    // Deposit flow
    _showDepositModal() {
        // Step 1: ask for amount
        const handle = Modal.show({
            title: 'Top Up Wallet',
            content: `
                <form id="wallet-deposit-form" novalidate>
                    <div class="form-group">
                        <label for="wd-amount">Amount (Kwacha)</label>
                        <input type="number" id="wd-amount" required min="5" max="10000" step="0.01" placeholder="e.g. 50">
                        <small style="color:#888;">Min: K5, Max: K10,000 per top-up.</small>
                    </div>
                    <div class="form-group">
                        <p style="font-size:13px; color:#888;">
                            You'll be redirected to confirm the payment with your mobile money provider in the next step.
                        </p>
                    </div>
                    <div id="wd-error" style="color:#ff4757; font-size:14px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Continue', class: 'btn-primary', action: 'continue' }
            ]
        });

        requestAnimationFrame(() => {
            const continueBtn = handle?.element?.querySelector('[data-action="continue"]');
            continueBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const errorEl = document.getElementById('wd-error');
                errorEl.textContent = '';
                const amount = parseFloat(document.getElementById('wd-amount').value);
                if (!Number.isFinite(amount) || amount < 5 || amount > 10_000) {
                    errorEl.textContent = 'Amount must be between K5 and K10,000';
                    return;
                }

                // Close the amount modal and open the payment flow modal.
                handle?.close?.();
                this._openPaymentFlow(amount);
            });
        });
    }

    _openPaymentFlow(amount) {
        PaymentFlowModal.show({
            title: 'Top Up Wallet',
            summary: `Topping up your wallet with K${amount.toFixed(2)}.`,
            amount,
            onConfirm: async ({ phoneNumber, method }) => {
                const result = await this.walletAPI.deposit(amount, method, phoneNumber);
                if (!result.success) {
                    return { error: result.error || 'Failed to start deposit' };
                }
                // Backend may return either a reference (async) or completed
                // synchronously (rare). Handle both.
                const data = result.data || {};
                return {
                    reference: data.reference || data.paymentReference || data.payment?.reference,
                    data
                };
            },
            onSuccess: async () => {
                // Refresh balance + transactions so the user sees the new state
                await this._loadBalance();
                this.currentPage = 1;
                await this._loadTransactions();
                this._renderTransactions();
                this._renderPagination();
                Toast.show?.('Wallet topped up successfully', 'success');
            },
            onFailure: ({ message }) => {
                Toast.show?.(message || 'Top-up failed', 'error');
            }
        });
    }

    _typeLabel(type) {
        const labels = {
            deposit: 'Deposit',
            purchase: 'Purchase',
            royalty: 'Royalty',
            withdrawal: 'Withdrawal',
            refund: 'Refund'
        };
        return labels[type] || 'Transaction';
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.WalletPage = WalletPage;
