/**
 * Comment Section Component
 */

class CommentSection {
    constructor(songId, containerId) {
        this.songId = songId;
        this.container = document.querySelector(containerId);
        this.comments = [];
        this.apiUrl = window.API_BASE_URL;
        this.init();
    }
    
    async init() {
        await this.loadComments();
        this.render();
        this.attachEventListeners();
    }
    
    async loadComments() {
        try {
            const token = localStorage.getItem('bravo_token');
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.COMMENTS}/song/${this.songId}`);
            const data = await response.json();
            this.comments = data.comments || [];
        } catch (error) {
            console.error('Load comments error:', error);
            this.comments = [];
        }
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="comment-section">
                <h3>Comments (${this.comments.length})</h3>
                
                <div class="comment-input">
                    <textarea id="comment-text" placeholder="Write a comment..." rows="2"></textarea>
                    <button class="btn-primary" id="submit-comment">Post Comment</button>
                </div>
                
                <div class="comments-list">
                    ${this.renderComments()}
                </div>
            </div>
        `;
    }
    
    renderComments() {
        if (this.comments.length === 0) {
            return '<div class="empty-state">No comments yet. Be the first to comment!</div>';
        }
        
        return this.comments.map(comment => `
            <div class="comment-item" data-comment-id="${comment._id}">
                <div class="comment-avatar">
                    <img src="${comment.user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'}" alt="${comment.user?.username}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${this.escapeHtml(comment.user?.username || 'Anonymous')}</span>
                        <span class="comment-time">${this.formatTime(comment.createdAt)}</span>
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.content)}</div>
                    <div class="comment-actions">
                        <button class="comment-like-btn" data-id="${comment._id}">
                            <i class="far fa-heart"></i> ${comment.likes?.length || 0}
                        </button>
                        <button class="comment-reply-btn" data-id="${comment._id}">Reply</button>
                        ${localStorage.getItem('bravo_token') ? `<button class="comment-report-btn" data-id="${comment._id}">Report</button>` : ''}
                    </div>
                    ${comment.replies?.length ? `
                        <div class="comment-replies">
                            ${comment.replies.map(reply => `
                                <div class="comment-item reply">
                                    <div class="comment-avatar">
                                        <img src="${reply.user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'}">
                                    </div>
                                    <div class="comment-content">
                                        <div class="comment-header">
                                            <span class="comment-author">${this.escapeHtml(reply.user?.username)}</span>
                                            <span class="comment-time">${this.formatTime(reply.createdAt)}</span>
                                        </div>
                                        <div class="comment-text">${this.escapeHtml(reply.content)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }
    
    attachEventListeners() {
        const submitBtn = document.getElementById('submit-comment');
        const commentText = document.getElementById('comment-text');
        
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitComment());
        }
        
        if (commentText) {
            commentText.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.submitComment();
                }
            });
        }
        
        document.querySelectorAll('.comment-like-btn').forEach(btn => {
            btn.addEventListener('click', () => this.likeComment(btn.dataset.id));
        });
        
        document.querySelectorAll('.comment-report-btn').forEach(btn => {
            btn.addEventListener('click', () => this.reportComment(btn.dataset.id));
        });
    }
    
    async submitComment() {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            Toast.show('Please login to comment', 'warning');
            window.location.hash = 'login';
            return;
        }
        
        const content = document.getElementById('comment-text').value.trim();
        if (!content) return;
        
        try {
            const response = await fetch(`${this.apiUrl}${window.API_ENDPOINTS.COMMENTS}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songId: this.songId, content })
            });
            
            if (response.ok) {
                Toast.show('Comment posted!', 'success');
                document.getElementById('comment-text').value = '';
                await this.loadComments();
                this.render();
                this.attachEventListeners();
            }
        } catch (error) {
            Toast.show('Failed to post comment', 'error');
        }
    }
    
    async likeComment(commentId) {
        const token = localStorage.getItem('bravo_token');
        if (!token) {
            Toast.show('Please login to like comments', 'warning');
            return;
        }
        
        try {
            await fetch(`${this.apiUrl}${window.API_ENDPOINTS.COMMENTS}/${commentId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await this.loadComments();
            this.render();
            this.attachEventListeners();
        } catch (error) {
            console.error('Like comment error:', error);
        }
    }
    
    async reportComment(commentId) {
        const token = localStorage.getItem('bravo_token');
        if (!token) return;
        
        Modal.show({
            title: 'Report Comment',
            content: `
                <form id="report-form">
                    <div class="form-group">
                        <label>Reason for reporting</label>
                        <select name="reason" required>
                            <option value="">Select reason</option>
                            <option value="spam">Spam</option>
                            <option value="harassment">Harassment</option>
                            <option value="hate_speech">Hate speech</option>
                            <option value="inappropriate">Inappropriate content</option>
                        </select>
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Report', class: 'btn-danger', action: 'report', onClick: async () => {
                    const reason = document.querySelector('#report-form select').value;
                    await fetch(`${this.apiUrl}${window.API_ENDPOINTS.COMMENTS}/${commentId}/report`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ reason })
                    });
                    Toast.show('Comment reported. Thank you for helping keep our community safe.', 'success');
                }}
            ]
        });
    }
    
    formatTime(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return d.toLocaleDateString();
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.CommentSection = CommentSection;