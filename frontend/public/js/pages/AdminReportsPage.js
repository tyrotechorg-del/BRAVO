/**
 * Admin Reports Page - Manage User Reports
 */

class AdminReportsPage {
    constructor() {
        this.reports = [];
        this.isLoading = false;
        this.statusFilter = 'pending';
        this.adminAPI = null;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadReports();
        
        return `
            <div class="admin-reports-page">
                <div class="page-header">
                    <h1><i class="fas fa-flag"></i> Reports Management</h1>
                    <p>Review and resolve user reports</p>
                </div>
                
                <div class="reports-stats">
                    <div class="stat-card-sm pending">
                        <div class="stat-value">${this.reports.filter(r => r.status === 'pending').length}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                    <div class="stat-card-sm resolved">
                        <div class="stat-value">${this.reports.filter(r => r.status === 'resolved').length}</div>
                        <div class="stat-label">Resolved</div>
                    </div>
                    <div class="stat-card-sm total">
                        <div class="stat-value">${this.reports.length}</div>
                        <div class="stat-label">Total Reports</div>
                    </div>
                </div>
                
                <div class="filters-bar">
                    <select id="status-filter" class="filter-select">
                        <option value="pending" ${this.statusFilter === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="resolved" ${this.statusFilter === 'resolved' ? 'selected' : ''}>Resolved</option>
                        <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>All Reports</option>
                    </select>
                    <button id="refresh-btn" class="btn-outline"><i class="fas fa-sync-alt"></i> Refresh</button>
                </div>
                
                <div class="reports-table-container">
                    <table class="data-table">
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
                        <tbody id="reports-table-body">
                            ${this.renderReportsList()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async loadReports() {
        this.isLoading = true;
        
        try {
            let result;
            if (this.statusFilter === 'all') {
                // Get both pending and resolved
                const pending = await this.adminAPI.getReports();
                const resolved = await this.adminAPI.getResolvedReports?.() || [];
                result = [...(pending || []), ...resolved];
            } else if (this.statusFilter === 'resolved') {
                result = await this.adminAPI.getResolvedReports?.() || [];
            } else {
                result = await this.adminAPI.getReports();
            }
            
            if (!result?.error) {
                this.reports = result || [];
            } else {
                this.reports = [];
            }
        } catch (error) {
            console.error('Load reports error:', error);
            this.reports = [];
        } finally {
            this.isLoading = false;
        }
    }

    renderReportsList() {
        if (this.isLoading) {
            return '<tr><td colspan="7" class="loading-cell">Loading reports...</td></tr>';
        }
        
        if (this.reports.length === 0) {
            return '<tr><td colspan="7" class="empty-cell">No reports found</td></tr>';
        }
        
        return this.reports.map(report => `
            <tr data-report-id="${report._id}" class="${report.status === 'pending' ? 'pending-row' : 'resolved-row'}">
                <td><span class="type-badge ${report.type}">${report.type}</span></td>
                <td><strong>${this.escapeHtml(report.reporter?.username || 'Unknown')}</strong><br><small>${report.reporter?.email || ''}</small></td>
                <td>${this.escapeHtml(report.contentId || 'N/A')}</td>
                <td>${this.escapeHtml(report.reason)}</td>
                <td><span class="status-badge ${report.status}">${report.status}</span></td>
                <td>${new Date(report.createdAt).toLocaleDateString()}</td>
                <td class="actions-cell">
                    ${report.status === 'pending' ? `
                        <button class="btn-success resolve-report" data-id="${report._id}" data-action="dismiss" title="Dismiss Report">
                            <i class="fas fa-check"></i> Dismiss
                        </button>
                        <button class="btn-warning resolve-report" data-id="${report._id}" data-action="warn" title="Warn User">
                            <i class="fas fa-exclamation-triangle"></i> Warn
                        </button>
                        <button class="btn-danger resolve-report" data-id="${report._id}" data-action="remove" title="Remove Content">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                        <button class="btn-danger resolve-report" data-id="${report._id}" data-action="ban" title="Ban User">
                            <i class="fas fa-ban"></i> Ban
                        </button>
                    ` : `
                        <span class="resolved-badge">Resolved by Admin</span>
                    `}
                    <button class="btn-icon view-report" data-id="${report._id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
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
                await this.loadReports();
                await this.render();
                await this.afterRender();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadReports();
                await this.render();
                await this.afterRender();
                Toast.show('Reports refreshed', 'success');
            });
        }
        
        document.querySelectorAll('.resolve-report').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reportId = btn.dataset.id;
                const action = btn.dataset.action;
                const notes = prompt('Enter admin notes for this action:');
                
                const result = await this.adminAPI.resolveReport(reportId, action, notes || '');
                if (!result.error) {
                    Toast.show(`Report ${action}ed successfully`, 'success');
                    await this.loadReports();
                    await this.render();
                    await this.afterRender();
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        });
        
        document.querySelectorAll('.view-report').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reportId = btn.dataset.id;
                const report = this.reports.find(r => r._id === reportId);
                if (report) {
                    this.showReportDetails(report);
                }
            });
        });
    }

    showReportDetails(report) {
        Modal.show({
            title: `Report Details`,
            content: `
                <div class="report-details">
                    <div class="detail-section">
                        <h4>Report Information</h4>
                        <p><strong>Type:</strong> ${report.type}</p>
                        <p><strong>Reason:</strong> ${this.escapeHtml(report.reason)}</p>
                        <p><strong>Description:</strong> ${this.escapeHtml(report.description || 'No description')}</p>
                        <p><strong>Status:</strong> ${report.status}</p>
                        <p><strong>Date:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Reporter</h4>
                        <p><strong>Username:</strong> ${report.reporter?.username}</p>
                        <p><strong>Email:</strong> ${report.reporter?.email}</p>
                    </div>
                    ${report.reportedUser ? `
                        <div class="detail-section">
                            <h4>Reported User</h4>
                            <p><strong>Username:</strong> ${report.reportedUser?.username}</p>
                            <p><strong>Email:</strong> ${report.reportedUser?.email}</p>
                        </div>
                    ` : ''}
                    ${report.adminNotes ? `
                        <div class="detail-section">
                            <h4>Admin Notes</h4>
                            <p>${this.escapeHtml(report.adminNotes)}</p>
                        </div>
                    ` : ''}
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

window.AdminReportsPage = AdminReportsPage;