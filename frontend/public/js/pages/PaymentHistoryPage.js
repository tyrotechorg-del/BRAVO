

class PaymentHistoryPage {
    constructor() {
        this.payments = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.typeFilter = '';
        this.paymentsAPI = new PaymentsAPI();
    }

    async render() {
        return `
            <div class="payment-history-page">
                <div class="page-header">
                    <h1><i class="fas fa-history"></i> Payment History</h1>
                    <p>Every payment you've made on Bravo Music.</p>
                </div>

                <div class="filters-bar" style="margin-bottom:16px;">
                    <select id="ph-type-filter">
                        <option value="">All Types</option>
                        <option value="subscription">Subscriptions</option>
                        <option value="song_purchase">Song Purchases</option>
                        <option value="album_purchase">Album Purchases</option>
                        <option value="deposit">Wallet Deposits</option>
                    </select>
                </div>

                <div id="ph-list" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div class="pagination" id="ph-pagination"></div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        document.getElementById('ph-type-filter')?.addEventListener('change', async (e) => {
            this.typeFilter = e.target.value || '';
            this.currentPage = 1;
            await this._load();
            this._renderList();
            this._renderPagination();
        });

        await this._load();
        this._renderList();
        this._renderPagination();
    }

    async _load() {
        const result = await this.paymentsAPI.getHistory(this.currentPage, 20, this.typeFilter || null);
        if (result.success) {
            const data = result.data || {};
            this.payments = data.payments || data.history || [];
            this.totalPages = data.totalPages || 1;
        } else {
            this.payments = [];
            this.totalPages = 1;
        }
    }

    _renderList() {
        const container = document.getElementById('ph-list');
        if (!container) return;

        if (this.payments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No payments yet</h3>
                    <p>Your payments will appear here once you subscribe or make a purchase.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="ph-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Reference</th>
                    </tr>
                </thead>
                <tbody id="ph-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('ph-tbody');
        this.payments.forEach(p => tbody.appendChild(this._buildRow(p)));
    }

    _buildRow(p) {
        const date = p.createdAt ? new Date(p.createdAt).toLocaleString() : '—';
        const safeDesc = this._escapeHtml(p.description || this._defaultDescription(p));
        const safeType = this._escapeHtml(p.type || 'payment');
        const safeMethod = this._escapeHtml(p.method || p.paymentMethod || '—');
        const amount = Number(p.amount || 0);
        const status = String(p.status || 'pending');
        const safeStatus = this._escapeHtml(status);
        const safeRef = this._escapeHtml(p.reference || p.paymentReference || '—');

        const tr = document.createElement('tr');
        tr.setAttribute('data-payment-id', p._id || p.id);
        tr.innerHTML = `
            <td><small>${this._escapeHtml(date)}</small></td>
            <td>${safeDesc}</td>
            <td><span class="type-badge type-${safeType}">${this._typeLabel(safeType)}</span></td>
            <td>${safeMethod}</td>
            <td><strong>K${amount.toFixed(2)}</strong></td>
            <td><span class="status-badge status-${safeStatus}">${safeStatus}</span></td>
            <td><code style="font-size:11px;">${safeRef}</code></td>
        `;
        return tr;
    }

    _renderPagination() {
        const container = document.getElementById('ph-pagination');
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
            await this._load();
            this._renderList();
            this._renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
    }

    _typeLabel(type) {
        const labels = {
            subscription: 'Subscription',
            song_purchase: 'Song Purchase',
            album_purchase: 'Album Purchase',
            deposit: 'Wallet Deposit',
            payment: 'Payment'
        };
        return labels[type] || type;
    }

    _defaultDescription(p) {
        // Reasonable fallback if backend didn't provide a description
        const t = p.type;
        if (t === 'subscription') return p.metadata?.planName || 'Subscription';
        if (t === 'song_purchase') return p.metadata?.songTitle || 'Song purchase';
        if (t === 'album_purchase') return p.metadata?.albumTitle || 'Album purchase';
        if (t === 'deposit') return 'Wallet top-up';
        return 'Payment';
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.PaymentHistoryPage = PaymentHistoryPage;
