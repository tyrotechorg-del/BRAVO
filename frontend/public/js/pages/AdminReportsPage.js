

class AdminReportsPage {
    constructor() {
        this.reports = [];
        this.statusFilter = 'pending';
        this.adminAPI = new AdminAPI();
        this.processing = new Set();
    }

    async render() {
        return `
            <div class="admin-reports-page">
                <div class="page-header">
                    <h1><i class="fas fa-flag"></i> Reports</h1>
                    <p>Review and resolve user reports.</p>
                </div>

                <div class="reports-stats" style="display:flex; gap:12px; margin-bottom:16px;">
                    <div class="stat-card-sm pending"><div class="stat-value" id="rp-stat-pending">—</div><div class="stat-label">Pending</div></div>
                    <div class="stat-card-sm resolved"><div class="stat-value" id="rp-stat-resolved">—</div><div class="stat-label">Resolved</div></div>
                    <div class="stat-card-sm total"><div class="stat-value" id="rp-stat-total">—</div><div class="stat-label">Total</div></div>
                </div>

                <div class="filters-bar" style="display:flex; gap:8px; margin-bottom:16px;">
                    <select id="rp-status-filter">
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                        <option value="">All</option>
                    </select>
                    <button class="btn-outline" type="button" id="rp-refresh-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                <div class="reports-table-container" id="rp-container" aria-live="polite">
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
        const filterSel = document.getElementById('rp-status-filter');
        if (filterSel) filterSel.value = this.statusFilter;

        filterSel?.addEventListener('change', async () => {
            this.statusFilter = filterSel.value;
            await this._loadAndRender();
        });
        document.getElementById('rp-refresh-btn')?.addEventListener('click', async () => {
            await this._loadAndRender();
            Toast.show?.('Refreshed', 'success');
        });

        await this._loadAndRender();
    }

    async _loadAndRender() {
        const result = await this.adminAPI.getReports(this.statusFilter || null);
        if (result.success) {
            this.reports = Array.isArray(result.data) ? result.data : (result.data?.reports || []);
        } else {
            this.reports = [];
        }
        this._renderStats();
        this._renderTable();
    }

    _renderStats() {
        const pending = this.reports.filter(r => r.status === 'pending').length;
        const resolved = this.reports.filter(r => r.status === 'resolved').length;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
        set('rp-stat-pending', pending);
        set('rp-stat-resolved', resolved);
        set('rp-stat-total', this.reports.length);
    }

    _renderTable() {
        const container = document.getElementById('rp-container');
        if (!container) return;

        if (this.reports.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-flag"></i>
                    <h3>No reports</h3>
                    <p>No reports match the current filter.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="rp-table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Reporter</th>
                        <th>Reported Item</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="rp-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('rp-tbody');
        this.reports.forEach(r => tbody.appendChild(this._buildRow(r)));

        document.getElementById('rp-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-report-id]');
            if (!row) return;
            const report = this.reports.find(r => String(r._id) === String(row.dataset.reportId));
            if (!report) return;
            const action = btn.dataset.action;
            if (action === 'view') this._showDetailsModal(report);
            else this._showResolveModal(report, row, action);
        });
    }

    _buildRow(r) {
        const safeType = this._escapeHtml(r.type || 'unknown');
        const safeReporter = this._escapeHtml(r.reporter?.username || 'Unknown');
        const safeEmail = this._escapeHtml(r.reporter?.email || '');
        const safeContentId = this._escapeHtml(r.contentId || 'N/A');
        const safeReason = this._escapeHtml(r.reason || '—');
        const safeStatus = this._escapeHtml(r.status || 'pending');
        const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—';
        const isPending = r.status === 'pending';

        const tr = document.createElement('tr');
        tr.setAttribute('data-report-id', r._id);
        tr.className = isPending ? 'pending-row' : 'resolved-row';

        const actions = isPending
            ? `
                <button class="btn-success btn-sm" type="button" data-action="dismiss" aria-label="Dismiss">
                    <i class="fas fa-check"></i> Dismiss
                </button>
                <button class="btn-warning btn-sm" type="button" data-action="warn" aria-label="Warn">
                    <i class="fas fa-exclamation-triangle"></i> Warn
                </button>
                <button class="btn-danger btn-sm" type="button" data-action="remove" aria-label="Remove content">
                    <i class="fas fa-trash"></i> Remove
                </button>
                <button class="btn-danger btn-sm" type="button" data-action="ban" aria-label="Ban user">
                    <i class="fas fa-ban"></i> Ban
                </button>
                <button class="btn-icon" type="button" data-action="view" aria-label="View details">
                    <i class="fas fa-eye"></i>
                </button>
            `
            : `
                <span class="resolved-badge">Resolved</span>
                <button class="btn-icon" type="button" data-action="view" aria-label="View details">
                    <i class="fas fa-eye"></i>
                </button>
            `;

        tr.innerHTML = `
            <td><span class="type-badge type-${safeType}">${safeType}</span></td>
            <td><strong>${safeReporter}</strong><br><small>${safeEmail}</small></td>
            <td><small>${safeContentId}</small></td>
            <td>${safeReason}</td>
            <td><span class="status-badge status-${safeStatus}">${safeStatus}</span></td>
            <td>${this._escapeHtml(date)}</td>
            <td class="actions-cell">${actions}</td>
        `;
        return tr;
    }

    _showResolveModal(report, rowEl, action) {
        if (this.processing.has(report._id)) return;
        const actionLabels = {
            dismiss: 'Dismiss Report',
            warn: 'Warn User',
            remove: 'Remove Content',
            ban: 'Ban User'
        };
        const actionDescs = {
            dismiss: 'Marks the report as reviewed with no further action.',
            warn: 'Sends a warning to the reported user.',
            remove: 'Removes the reported content from the platform.',
            ban: 'Bans the reported user. This action is heavy — be sure.'
        };
        const title = actionLabels[action] || 'Resolve Report';
        const desc = actionDescs[action] || '';
        const isHeavy = action === 'ban' || action === 'remove';

        const handle = Modal.show({
            title,
            content: `
                <p>${this._escapeHtml(desc)}</p>
                <form id="rp-resolve-form" novalidate>
                    <div class="form-group">
                        <label for="rp-notes">Admin Notes ${isHeavy ? '*' : '(optional)'}</label>
                        <textarea id="rp-notes" rows="3" maxlength="500" ${isHeavy ? 'required' : ''}></textarea>
                    </div>
                    <div id="rp-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: title, class: isHeavy ? 'btn-danger' : 'btn-primary', action: 'submit' }
            ]
        });

        requestAnimationFrame(() => {
            const submitBtn = handle?.element?.querySelector('[data-action="submit"]');
            submitBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const notes = document.getElementById('rp-notes').value.trim();
                const errorEl = document.getElementById('rp-error');

                if (isHeavy && notes.length < 5) {
                    errorEl.textContent = 'Notes are required for this action (min 5 chars)';
                    return;
                }

                this.processing.add(report._id);
                rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';

                const result = await this.adminAPI.resolveReport(report._id, action, notes);

                this.processing.delete(report._id);
                submitBtn.disabled = false;
                submitBtn.textContent = title;

                if (!result.success) {
                    errorEl.textContent = result.error || 'Resolution failed';
                    rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
                    return;
                }

                handle?.close?.();
                Toast.show?.(`Report ${action}ed`, 'success');

                // Update model + row
                const idx = this.reports.findIndex(r => r._id === report._id);
                if (idx >= 0) {
                    this.reports[idx] = { ...this.reports[idx], status: 'resolved', adminNotes: notes };
                }
                this._renderStats();
                if (this.statusFilter === 'pending') {
                    if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
                    if (document.getElementById('rp-tbody')?.children.length === 0) this._renderTable();
                } else {
                    // Re-render the single row to show resolved state
                    const newRow = this._buildRow(this.reports[idx]);
                    rowEl.parentNode.replaceChild(newRow, rowEl);
                }
            });
        });
    }

    _showDetailsModal(r) {
        Modal.show({
            title: 'Report Details',
            content: `
                <div class="report-details">
                    <div class="detail-section">
                        <h4>Report</h4>
                        <p><strong>Type:</strong> ${this._escapeHtml(r.type || 'unknown')}</p>
                        <p><strong>Reason:</strong> ${this._escapeHtml(r.reason || '—')}</p>
                        <p><strong>Description:</strong> ${this._escapeHtml(r.description || 'No description')}</p>
                        <p><strong>Status:</strong> ${this._escapeHtml(r.status || 'pending')}</p>
                        <p><strong>Date:</strong> ${r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</p>
                        <p><strong>Content ID:</strong> ${this._escapeHtml(r.contentId || 'N/A')}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Reporter</h4>
                        <p><strong>Username:</strong> ${this._escapeHtml(r.reporter?.username || 'Unknown')}</p>
                        <p><strong>Email:</strong> ${this._escapeHtml(r.reporter?.email || '')}</p>
                    </div>
                    ${r.reportedUser ? `
                        <div class="detail-section">
                            <h4>Reported User</h4>
                            <p><strong>Username:</strong> ${this._escapeHtml(r.reportedUser.username || '')}</p>
                            <p><strong>Email:</strong> ${this._escapeHtml(r.reportedUser.email || '')}</p>
                        </div>
                    ` : ''}
                    ${r.adminNotes ? `
                        <div class="detail-section">
                            <h4>Admin Notes</h4>
                            <p>${this._escapeHtml(r.adminNotes)}</p>
                        </div>
                    ` : ''}
                </div>
            `,
            buttons: [{ text: 'Close', class: 'btn-secondary', action: 'close' }]
        });
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AdminReportsPage = AdminReportsPage;
