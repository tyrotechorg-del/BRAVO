/**
 * Admin Withdrawals Page - Process Artist Withdrawals
 */

class AdminWithdrawalsPage {
    constructor() {
        this.withdrawals = [];
        this.isLoading = false;
        this.statusFilter = 'pending';
        this.adminAPI = null;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadWithdrawals();
        
        return `
            <div class="admin-withdrawals-page">
                <div class="page-header">
                    <h1><i class="fas fa-money-bill-wave"></i> Withdrawals Management</h1>
                    <p>Process artist withdrawal requests</p>
                </div>
                
                <div class="withdrawals-stats">
                    <div class="stat-card-sm pending">
                        <div class="stat-value">${this.withdrawals.filter(w => w.status === 'pending').length}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                    <div class="stat-card-sm approved">
                        <div class="stat-value">${this.withdrawals.filter(w => w.status === 'approved').length}</div>
                        <div class="stat-label">Approved</div>
                    </div>
                    <div class="stat-card-sm total">
                        <div class="stat-value">K${this.withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0).toLocaleString()}</div>
                        <div class="stat-label">Total Amount</div>
                    </div>
                </div>
                
                <div class="filters-bar">
                    <select id="status-filter" class="filter-select">
                        <option value="pending" ${this.statusFilter === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${this.statusFilter === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="rejected" ${this.statusFilter === 'rejected' ? 'selected' : ''}>Rejected</option>
                        <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>All</option>
                    </select>
                    <button id="refresh-btn" class="btn-outline"><i class="fas fa-sync-alt"></i> Refresh</button>
                </div>
                
                <div class="withdrawals-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Artist</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th>Account Details</th>
                                <th>Status</th>
                                <th>Requested</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="withdrawals-table-body">
                            ${this.renderWithdrawalsList()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async loadWithdrawals() {
        this.isLoading = true;
        
        try {
            let result;
            if (this.statusFilter === 'all') {
                result = await this.adminAPI.getWithdrawals();
            } else {
                result = await this.adminAPI.getWithdrawals(this.statusFilter);
            }
            
            if (!result.error) {
                this.withdrawals = result;
            } else {
                this.withdrawals = [];
            }
        } catch (error) {
            console.error('Load withdrawals error:', error);
            this.withdrawals = [];
        } finally {
            this.isLoading = false;
        }
    }

    renderWithdrawalsList() {
        if (this.isLoading) {
            return '<tr><td colspan="7" class="loading-cell">Loading withdrawals...</td></tr>';
        }
        
        if (this.withdrawals.length === 0) {
            return '<tr><td colspan="7" class="empty-cell">No withdrawals found</td></tr>';
        }
        
        return this.withdrawals.map(withdrawal => `
            <tr data-withdrawal-id="${withdrawal._id}">
                <td><strong>${this.escapeHtml(withdrawal.user?.username || 'Unknown')}</strong><br><small>${withdrawal.user?.email || ''}</small></td>
                <td><span class="amount">K${withdrawal.amount.toFixed(2)}</span></td>
                <td><span class="method-badge">${withdrawal.method}</span></td>
                <td><small>${this.formatAccountDetails(withdrawal.accountDetails)}</small></td>
                <td><span class="status-badge ${withdrawal.status}">${withdrawal.status}</span></td>
                <td>${new Date(withdrawal.createdAt).toLocaleDateString()}</td>
                <td class="actions-cell">
                    ${withdrawal.status === 'pending' ? `
                        <button class="btn-success approve-withdrawal" data-id="${withdrawal._id}" data-amount="${withdrawal.amount}">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="btn-danger reject-withdrawal" data-id="${withdrawal._id}">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    ` : `
                        <span class="processed-badge">${withdrawal.status}</span>
                    `}
                    <button class="btn-icon view-withdrawal" data-id="${withdrawal._id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
             </tr>
        `).join('');
    }

    formatAccountDetails(details) {
        if (!details) return 'N/A';
        if (details.phoneNumber) return `Phone: ${details.phoneNumber}`;
        if (details.accountNumber) return `${details.bankName || 'Bank'}: ${details.accountNumber}`;
        return 'N/A';
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        const statusFilter = document.getElementById('status-filter');
        const refreshBtn = document.getElementById('refresh-btn');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', async () => {
                this.statusFilter = statusFilter.value;
                await this.loadWithdrawals();
                await this.render();
                await this.afterRender();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadWithdrawals();
                await this.render();
                await this.afterRender();
                Toast.show('Withdrawals refreshed', 'success');
            });
        }
        
        document.querySelectorAll('.approve-withdrawal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const withdrawalId = btn.dataset.id;
                const amount = btn.dataset.amount;
                const reference = prompt(`Enter transaction reference for K${amount} withdrawal:`);
                
                if (reference) {
                    const result = await this.adminAPI.processWithdrawal(withdrawalId, 'approve', reference);
                    if (!result.error) {
                        Toast.show(`Withdrawal approved! Reference: ${reference}`, 'success');
                        await this.loadWithdrawals();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
        
        document.querySelectorAll('.reject-withdrawal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const withdrawalId = btn.dataset.id;
                const reason = prompt('Enter rejection reason:');
                
                if (reason !== null) {
                    const result = await this.adminAPI.processWithdrawal(withdrawalId, 'reject');
                    if (!result.error) {
                        Toast.show(`Withdrawal rejected`, 'info');
                        await this.loadWithdrawals();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
        
        document.querySelectorAll('.view-withdrawal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const withdrawalId = btn.dataset.id;
                const withdrawal = this.withdrawals.find(w => w._id === withdrawalId);
                if (withdrawal) {
                    this.showWithdrawalDetails(withdrawal);
                }
            });
        });
    }

    showWithdrawalDetails(withdrawal) {
        Modal.show({
            title: `Withdrawal Details`,
            content: `
                <div class="withdrawal-details">
                    <div class="detail-section">
                        <h4>Request Information</h4>
                        <p><strong>Amount:</strong> K${withdrawal.amount.toFixed(2)}</p>
                        <p><strong>Method:</strong> ${withdrawal.method}</p>
                        <p><strong>Status:</strong> ${withdrawal.status}</p>
                        <p><strong>Requested:</strong> ${new Date(withdrawal.createdAt).toLocaleString()}</p>
                        ${withdrawal.processedAt ? `<p><strong>Processed:</strong> ${new Date(withdrawal.processedAt).toLocaleString()}</p>` : ''}
                        ${withdrawal.transactionReference ? `<p><strong>Reference:</strong> ${withdrawal.transactionReference}</p>` : ''}
                    </div>
                    <div class="detail-section">
                        <h4>Artist Information</h4>
                        <p><strong>Username:</strong> ${withdrawal.user?.username}</p>
                        <p><strong>Email:</strong> ${withdrawal.user?.email}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Account Details</h4>
                        <pre>${JSON.stringify(withdrawal.accountDetails, null, 2)}</pre>
                    </div>
                </div>
            `,
            buttons: [{ text: 'Close', class: 'btn-secondary', action: 'close' }]
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.AdminWithdrawalsPage = AdminWithdrawalsPage;