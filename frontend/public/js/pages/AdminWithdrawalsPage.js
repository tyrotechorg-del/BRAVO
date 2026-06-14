/**
 * Admin Withdrawals Page
 */

class AdminWithdrawalsPage {
    constructor() {
        this.withdrawals = [];
        this.statusFilter = 'pending';
        this.adminAPI = new AdminAPI();
        this.processing = new Set(); // IDs currently being processed
    }

    async render() {
        return `
            <div class="admin-withdrawals-page">
                <div class="page-header">
                    <h1><i class="fas fa-money-bill-wave"></i> Withdrawals</h1>
                    <p>Process artist withdrawal requests.</p>
                </div>

                <div class="withdrawals-stats" id="wd-stats" style="display:flex; gap:12px; margin-bottom:16px;">
                    <div class="stat-card-sm pending"><div class="stat-value" id="wd-stat-pending">—</div><div class="stat-label">Pending</div></div>
                    <div class="stat-card-sm approved"><div class="stat-value" id="wd-stat-approved">—</div><div class="stat-label">Approved</div></div>
                    <div class="stat-card-sm total"><div class="stat-value" id="wd-stat-total">—</div><div class="stat-label">Total Requested</div></div>
                </div>

                <div class="filters-bar" style="display:flex; gap:8px; margin-bottom:16px;">
                    <select id="wd-status-filter">
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="">All</option>
                    </select>
                    <button class="btn-outline" type="button" id="wd-refresh-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                <div class="withdrawals-table-container" id="wd-container" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAdmin?.()) {
            Toast.show?.('Admin access required', 'error');
            return;
        }

        const filterSel = document.getElementById('wd-status-filter');
        if (filterSel) filterSel.value = this.statusFilter;

        filterSel?.addEventListener('change', async () => {
            this.statusFilter = filterSel.value;
            await this._loadAndRender();
        });
        document.getElementById('wd-refresh-btn')?.addEventListener('click', async () => {
            await this._loadAndRender();
            Toast.show?.('Refreshed', 'success');
        });

        await this._loadAndRender();
    }

    async _loadAndRender() {
        await this._loadWithdrawals();
        this._renderStats();
        this._renderTable();
    }

    async _loadWithdrawals() {
        const result = await this.adminAPI.getWithdrawals(this.statusFilter || null);
        if (result.success) {
            const data = result.data;
            // Tolerate either { withdrawals: [...] } or a raw array.
            this.withdrawals = Array.isArray(data) ? data : (data?.withdrawals || []);
        } else {
            this.withdrawals = [];
        }
    }

    _renderStats() {
        const pending = this.withdrawals.filter(w => w.status === 'pending').length;
        const approved = this.withdrawals.filter(w => w.status === 'approved' || w.status === 'completed').length;
        const total = this.withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('wd-stat-pending', String(pending));
        set('wd-stat-approved', String(approved));
        set('wd-stat-total', `K${total.toLocaleString()}`);
    }

    _renderTable() {
        const container = document.getElementById('wd-container');
        if (!container) return;

        if (this.withdrawals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-money-bill-wave"></i>
                    <h3>No withdrawals</h3>
                    <p>No withdrawal requests match the current filter.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="wd-table">
                <thead>
                    <tr>
                        <th>Artist</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Account</th>
                        <th>Status</th>
                        <th>Requested</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="wd-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('wd-tbody');
        this.withdrawals.forEach(w => tbody.appendChild(this._buildRow(w)));

        document.getElementById('wd-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-withdrawal-id]');
            if (!row) return;
            const w = this.withdrawals.find(x => String(x._id) === String(row.dataset.withdrawalId));
            if (!w) return;
            const action = btn.dataset.action;
            if (action === 'approve') this._showApproveModal(w, row);
            else if (action === 'reject') this._showRejectModal(w, row);
            else if (action === 'view') this._showDetailsModal(w);
        });
    }

    _buildRow(w) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-withdrawal-id', w._id);

        const safeUsername = this._escapeHtml(w.user?.username || 'Unknown');
        const safeEmail = this._escapeHtml(w.user?.email || '');
        const safeMethod = this._escapeHtml(w.method || '');
        const amount = Number(w.amount || 0).toFixed(2);
        const status = String(w.status || 'pending');
        const safeStatus = this._escapeHtml(status);
        const requested = w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—';
        const accountSummary = this._escapeHtml(this._formatAccountSummary(w.accountDetails, w.method));

        const isPending = status === 'pending';
        const actions = isPending
            ? `
                <button class="btn-success btn-sm" type="button" data-action="approve" aria-label="Approve">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-danger btn-sm" type="button" data-action="reject" aria-label="Reject">
                    <i class="fas fa-times"></i> Reject
                </button>
                <button class="btn-icon" type="button" data-action="view" aria-label="View details">
                    <i class="fas fa-eye"></i>
                </button>
            `
            : `
                <button class="btn-icon" type="button" data-action="view" aria-label="View details">
                    <i class="fas fa-eye"></i>
                </button>
            `;

        tr.innerHTML = `
            <td><strong>${safeUsername}</strong><br><small>${safeEmail}</small></td>
            <td><span class="amount">K${amount}</span></td>
            <td><span class="method-badge">${safeMethod}</span></td>
            <td><small>${accountSummary}</small></td>
            <td><span class="status-badge status-${safeStatus}">${safeStatus}</span></td>
            <td>${this._escapeHtml(requested)}</td>
            <td class="actions-cell">${actions}</td>
        `;
        return tr;
    }

    _formatAccountSummary(details, method) {
        if (!details || typeof details !== 'object') return '—';
        if (method === 'bank_transfer') {
            const acct = String(details.accountNumber || '');
            const masked = acct.length > 4 ? `••••${acct.slice(-4)}` : acct;
            return `${details.bankName || '?'} — ${masked}`;
        }
        if (details.phoneNumber) {
            const ph = String(details.phoneNumber);
            return ph.length > 4 ? `${ph.slice(0, 3)}••${ph.slice(-3)}` : ph;
        }
        return 'See details';
    }

    // Approve modal
    _showApproveModal(w, rowEl) {
        if (this.processing.has(w._id)) return;
        const handle = Modal.show({
            title: 'Approve Withdrawal',
            content: `
                <p>You are about to approve withdrawal of <strong>K${Number(w.amount || 0).toFixed(2)}</strong> to <strong>${this._escapeHtml(w.user?.username || 'Unknown')}</strong>.</p>
                <form id="wd-approve-form" novalidate>
                    <div class="form-group">
                        <label for="wd-approve-ref">Transaction Reference *</label>
                        <input type="text" id="wd-approve-ref" required maxlength="100" placeholder="e.g. MTN-2026-ABCD1234">
                        <small style="color:#888;">Internal reference for this payout (4+ characters).</small>
                    </div>
                    <div class="form-group">
                        <label for="wd-approve-notes">Notes (optional)</label>
                        <textarea id="wd-approve-notes" rows="2" maxlength="500"></textarea>
                    </div>
                    <div id="wd-approve-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Confirm Approval', class: 'btn-success', action: 'approve' }
            ]
        });

        requestAnimationFrame(() => {
            const submitBtn = handle?.element?.querySelector('[data-action="approve"]');
            submitBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._submitApprove(w, rowEl, handle);
            });
        });
    }

    async _submitApprove(w, rowEl, handle) {
        const errorEl = document.getElementById('wd-approve-error');
        errorEl.textContent = '';

        const reference = document.getElementById('wd-approve-ref').value.trim();
        const notes = document.getElementById('wd-approve-notes').value.trim();

        if (reference.length < 4) {
            errorEl.textContent = 'Reference must be at least 4 characters';
            return;
        }
        if (!/^[a-zA-Z0-9_\- ]+$/.test(reference)) {
            errorEl.textContent = 'Reference can only contain letters, numbers, spaces, dashes';
            return;
        }

        this.processing.add(w._id);
        // Disable both row buttons immediately
        rowEl?.querySelectorAll('[data-action="approve"], [data-action="reject"]').forEach(b => b.disabled = true);

        const submitBtn = handle?.element?.querySelector('[data-action="approve"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Approving...';
        }

        const result = await this.adminAPI.processWithdrawal(w._id, 'approve', reference, notes);

        this.processing.delete(w._id);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm Approval';
        }

        if (!result.success) {
            errorEl.textContent = result.error || 'Approval failed';
            // Re-enable row buttons (the action failed; let admin retry)
            rowEl?.querySelectorAll('[data-action="approve"], [data-action="reject"]').forEach(b => b.disabled = false);
            return;
        }

        handle?.close?.();
        Toast.show?.('Withdrawal approved', 'success');

        // Update local model + row in place
        const idx = this.withdrawals.findIndex(x => x._id === w._id);
        if (idx >= 0) {
            this.withdrawals[idx] = { ...this.withdrawals[idx], status: 'approved', transactionReference: reference };
        }
        this._refreshRow(w._id);
        this._renderStats();
    }

    // Reject modal
    _showRejectModal(w, rowEl) {
        if (this.processing.has(w._id)) return;
        const handle = Modal.show({
            title: 'Reject Withdrawal',
            content: `
                <p>Reject withdrawal of <strong>K${Number(w.amount || 0).toFixed(2)}</strong> from <strong>${this._escapeHtml(w.user?.username || 'Unknown')}</strong>?</p>
                <p style="color:#888; font-size:13px;">The amount will be returned to the artist's available balance.</p>
                <form id="wd-reject-form" novalidate>
                    <div class="form-group">
                        <label for="wd-reject-reason">Rejection Reason *</label>
                        <textarea id="wd-reject-reason" required rows="3" maxlength="500"
                                  placeholder="Why is this withdrawal being rejected?"></textarea>
                    </div>
                    <div id="wd-reject-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Confirm Rejection', class: 'btn-danger', action: 'reject' }
            ]
        });

        requestAnimationFrame(() => {
            const submitBtn = handle?.element?.querySelector('[data-action="reject"]');
            submitBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._submitReject(w, rowEl, handle);
            });
        });
    }

    async _submitReject(w, rowEl, handle) {
        const errorEl = document.getElementById('wd-reject-error');
        errorEl.textContent = '';

        const reason = document.getElementById('wd-reject-reason').value.trim();
        if (reason.length < 5) {
            errorEl.textContent = 'Reason must be at least 5 characters';
            return;
        }

        this.processing.add(w._id);
        rowEl?.querySelectorAll('[data-action="approve"], [data-action="reject"]').forEach(b => b.disabled = true);

        const submitBtn = handle?.element?.querySelector('[data-action="reject"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Rejecting...';
        }

        // captured the reason from prompt() and then dropped it.
        const result = await this.adminAPI.processWithdrawal(w._id, 'reject', null, reason);

        this.processing.delete(w._id);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm Rejection';
        }

        if (!result.success) {
            errorEl.textContent = result.error || 'Rejection failed';
            rowEl?.querySelectorAll('[data-action="approve"], [data-action="reject"]').forEach(b => b.disabled = false);
            return;
        }

        handle?.close?.();
        Toast.show?.('Withdrawal rejected', 'info');

        const idx = this.withdrawals.findIndex(x => x._id === w._id);
        if (idx >= 0) {
            this.withdrawals[idx] = { ...this.withdrawals[idx], status: 'rejected', notes: reason };
        }
        this._refreshRow(w._id);
        this._renderStats();
    }

    _refreshRow(withdrawalId) {
        const row = document.querySelector(`[data-withdrawal-id="${withdrawalId}"]`);
        if (!row) return;
        const w = this.withdrawals.find(x => x._id === withdrawalId);
        if (!w) return;
        const newRow = this._buildRow(w);
        row.parentNode.replaceChild(newRow, row);
    }

    // Details modal
    _showDetailsModal(w) {
        // Account details safely stringified — textContent assignment
        // after mount avoids HTML interpretation.
        const handle = Modal.show({
            title: 'Withdrawal Details',
            content: `
                <div class="withdrawal-details">
                    <div class="detail-section">
                        <h4>Request</h4>
                        <p><strong>Amount:</strong> K${Number(w.amount || 0).toFixed(2)}</p>
                        <p><strong>Method:</strong> ${this._escapeHtml(w.method || '')}</p>
                        <p><strong>Status:</strong> ${this._escapeHtml(w.status || '')}</p>
                        <p><strong>Requested:</strong> ${w.createdAt ? new Date(w.createdAt).toLocaleString() : '—'}</p>
                        ${w.processedAt ? `<p><strong>Processed:</strong> ${new Date(w.processedAt).toLocaleString()}</p>` : ''}
                        ${w.transactionReference ? `<p><strong>Reference:</strong> ${this._escapeHtml(w.transactionReference)}</p>` : ''}
                        ${w.notes ? `<p><strong>Notes:</strong> ${this._escapeHtml(w.notes)}</p>` : ''}
                    </div>
                    <div class="detail-section">
                        <h4>Artist</h4>
                        <p><strong>Username:</strong> ${this._escapeHtml(w.user?.username || '')}</p>
                        <p><strong>Email:</strong> ${this._escapeHtml(w.user?.email || '')}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Account Details</h4>
                        <pre id="wd-details-account" style="background:#f5f5f5; padding:12px; border-radius:4px; font-family:monospace; font-size:13px; white-space: pre-wrap; word-wrap: break-word;"></pre>
                    </div>
                </div>
            `,
            buttons: [{ text: 'Close', class: 'btn-secondary', action: 'close' }]
        });

        requestAnimationFrame(() => {
            const pre = document.getElementById('wd-details-account');
            if (pre) {
                // textContent assignment — bulletproof against HTML in the JSON
                pre.textContent = JSON.stringify(w.accountDetails || {}, null, 2);
            }
        });
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AdminWithdrawalsPage = AdminWithdrawalsPage;
