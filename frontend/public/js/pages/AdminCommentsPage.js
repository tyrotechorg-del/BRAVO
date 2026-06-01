/**
 * Admin Comments Page - Moderate User Comments
 */

class AdminCommentsPage {
    constructor() {
        this.comments = [];
        this.isLoading = false;
        this.adminAPI = null;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadComments();
        
        return `
            <div class="admin-comments-page">
                <div class="page-header">
                    <h1><i class="fas fa-comment"></i> Comments Moderation</h1>
                    <p>Review and manage reported comments</p>
                </div>
                
                <div class="comments-stats">
                    <div class="stat-card-sm reported">
                        <div class="stat-value">${this.comments.length}</div>
                        <div class="stat-label">Reported Comments</div>
                    </div>
                </div>
                
                <div class="comments-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Song</th>
                                <th>Comment</th>
                                <th>Report Reason</th>
                                <th>Reported On</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="comments-table-body">
                            ${this.renderCommentsList()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async loadComments() {
        this.isLoading = true;
        
        try {
            const result = await this.adminAPI.getReportedComments();
            if (!result.error) {
                this.comments = result;
            } else {
                this.comments = [];
            }
        } catch (error) {
            console.error('Load comments error:', error);
            this.comments = [];
        } finally {
            this.isLoading = false;
        }
    }

    renderCommentsList() {
        if (this.isLoading) {
            return '<tr><td colspan="6" class="loading-cell">Loading comments...</td></tr>';
        }
        
        if (this.comments.length === 0) {
            return '<tr><td colspan="6" class="empty-cell">No reported comments found</td></tr>';
        }
        
        return this.comments.map(comment => `
            <tr data-comment-id="${comment._id}">
                <td><strong>${this.escapeHtml(comment.user?.username || 'Unknown')}</strong><br><small>${comment.user?._id || ''}</small></td>
                <td>${comment.song?.title || 'Unknown Song'}</td>
                <td class="comment-text">"${this.escapeHtml(comment.content)}"</td>
                <td>${this.escapeHtml(comment.flaggedReason || 'No reason provided')}</td>
                <td>${new Date(comment.flaggedAt).toLocaleString()}</td>
                <td class="actions-cell">
                    <button class="btn-danger delete-comment" data-id="${comment._id}" title="Delete Comment">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn-warning dismiss-comment" data-id="${comment._id}" title="Dismiss Report">
                        <i class="fas fa-check"></i> Dismiss
                    </button>
                    <button class="btn-icon view-song" data-song-id="${comment.song?._id}" title="View Song">
                        <i class="fas fa-music"></i>
                    </button>
                </td>
             </tr>
        `).join('');
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        document.querySelectorAll('.delete-comment').forEach(btn => {
            btn.addEventListener('click', async () => {
                const commentId = btn.dataset.id;
                if (confirm('Delete this comment permanently?')) {
                    const result = await this.adminAPI.deleteComment(commentId);
                    if (!result.error) {
                        Toast.show('Comment deleted', 'success');
                        await this.loadComments();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }
            });
        });
        
        document.querySelectorAll('.dismiss-comment').forEach(btn => {
            btn.addEventListener('click', async () => {
                const commentId = btn.dataset.id;
                // Just dismiss the report without deleting
                Toast.show('Comment report dismissed', 'info');
                btn.closest('tr')?.remove();
            });
        });
        
        document.querySelectorAll('.view-song').forEach(btn => {
            btn.addEventListener('click', () => {
                const songId = btn.dataset.songId;
                if (songId) {
                    window.location.hash = `song/${songId}`;
                }
            });
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.AdminCommentsPage = AdminCommentsPage;