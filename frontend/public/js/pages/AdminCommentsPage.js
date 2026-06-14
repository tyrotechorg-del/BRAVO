

class AdminCommentsPage {
    constructor() {
        this.comments = [];
        this.adminAPI = new AdminAPI();
        this.processing = new Set();
    }

    async render() {
        return `
            <div class="admin-comments-page">
                <div class="page-header">
                    <h1><i class="fas fa-comment"></i> Reported Comments</h1>
                    <p>Review and moderate comments flagged by users.</p>
                </div>

                <div class="comments-stats" style="margin-bottom:16px;">
                    <div class="stat-card-sm reported">
                        <div class="stat-value" id="ac-stat-count">—</div>
                        <div class="stat-label">Reported Comments</div>
                    </div>
                </div>

                <div class="comments-table-container" id="ac-container" aria-live="polite">
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
        await this._loadComments();
        this._renderTable();
    }

    async _loadComments() {
        const result = await this.adminAPI.getReportedComments();
        if (result.success) {
            this.comments = Array.isArray(result.data) ? result.data : (result.data?.comments || []);
        } else {
            this.comments = [];
        }
        const stat = document.getElementById('ac-stat-count');
        if (stat) stat.textContent = String(this.comments.length);
    }

    _renderTable() {
        const container = document.getElementById('ac-container');
        if (!container) return;

        if (this.comments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>No reported comments</h3>
                    <p>Nothing to moderate right now.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table" id="ac-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Song</th>
                        <th>Comment</th>
                        <th>Reason</th>
                        <th>Reported At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="ac-tbody"></tbody>
            </table>
        `;

        const tbody = document.getElementById('ac-tbody');
        this.comments.forEach(c => tbody.appendChild(this._buildRow(c)));

        document.getElementById('ac-table')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-comment-id]');
            if (!row) return;
            const comment = this.comments.find(c => String(c._id) === String(row.dataset.commentId));
            if (!comment) return;
            const action = btn.dataset.action;
            if (action === 'delete') this._delete(comment, row);
            else if (action === 'dismiss') this._dismiss(comment, row);
            else if (action === 'view-song') this._viewSong(comment);
        });
    }

    _buildRow(c) {
        const safeUsername = this._escapeHtml(c.user?.username || 'Unknown');
        const safeSongTitle = this._escapeHtml(c.song?.title || 'Unknown Song');
        const safeContent = this._escapeHtml(c.content || '');
        const safeReason = this._escapeHtml(c.flaggedReason || c.reportReason || 'No reason provided');
        const reportedAt = c.flaggedAt || c.reportedAt || c.createdAt;
        const dateStr = reportedAt ? new Date(reportedAt).toLocaleString() : '—';

        const tr = document.createElement('tr');
        tr.setAttribute('data-comment-id', c._id);
        tr.innerHTML = `
            <td><strong>${safeUsername}</strong></td>
            <td>${safeSongTitle}</td>
            <td class="comment-text">"${safeContent}"</td>
            <td>${safeReason}</td>
            <td>${this._escapeHtml(dateStr)}</td>
            <td class="actions-cell">
                <button class="btn-danger btn-sm" type="button" data-action="delete" aria-label="Delete comment">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn-warning btn-sm" type="button" data-action="dismiss" aria-label="Dismiss report">
                    <i class="fas fa-check"></i> Dismiss
                </button>
                ${c.song?._id ? `
                    <button class="btn-icon" type="button" data-action="view-song" aria-label="View song">
                        <i class="fas fa-music"></i>
                    </button>
                ` : ''}
            </td>
        `;
        return tr;
    }

    async _delete(comment, rowEl) {
        if (this.processing.has(comment._id)) return;

        const doDelete = async () => {
            this.processing.add(comment._id);
            rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);

            const result = await this.adminAPI.deleteComment(comment._id);
            this.processing.delete(comment._id);

            if (!result.success) {
                Toast.show?.(result.error || 'Failed to delete', 'error');
                rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
                return;
            }

            this.comments = this.comments.filter(c => c._id !== comment._id);
            if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
            const stat = document.getElementById('ac-stat-count');
            if (stat) stat.textContent = String(this.comments.length);
            if (this.comments.length === 0) this._renderTable();
            Toast.show?.('Comment deleted', 'success');
        };

        if (window.Modal?.confirm) {
            Modal.confirm('Delete this comment permanently?', doDelete);
        } else if (confirm('Delete this comment permanently?')) {
            doDelete();
        }
    }

    
    async _dismiss(comment, rowEl) {
        if (this.processing.has(comment._id)) return;
        this.processing.add(comment._id);
        rowEl?.querySelectorAll('button').forEach(b => b.disabled = true);

        const result = await this.adminAPI.dismissCommentReport(comment._id);
        this.processing.delete(comment._id);

        if (!result.success) {
            Toast.show?.(result.error || 'Failed to dismiss', 'error');
            rowEl?.querySelectorAll('button').forEach(b => b.disabled = false);
            return;
        }

        this.comments = this.comments.filter(c => c._id !== comment._id);
        if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
        const stat = document.getElementById('ac-stat-count');
        if (stat) stat.textContent = String(this.comments.length);
        if (this.comments.length === 0) this._renderTable();
        Toast.show?.('Report dismissed', 'info');
    }

    _viewSong(comment) {
        const songId = comment.song?._id;
        if (!songId) return;
        if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo(`song/${songId}`);
        else window.location.hash = `song/${songId}`;
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AdminCommentsPage = AdminCommentsPage;
