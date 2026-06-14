

class CommentSection {
    constructor(songId, containerId) {
        this.songId = songId;
        this.container = document.querySelector(containerId);
        this.comments = [];
        this.isPosting = false;
        this.apiUrl = window.API_BASE_URL;
        this.commentsPath = (window.API_ENDPOINTS && window.API_ENDPOINTS.COMMENTS) || '/comments';
        this.init();
    }

    async init() {
        await this._loadComments();
        this._render();
        this._attachListeners();
    }

    async _loadComments() {
        try {
            const response = await fetch(
                `${this.apiUrl}${this.commentsPath}/song/${encodeURIComponent(this.songId)}`
            );
            const data = await response.json().catch(() => null);
            this.comments = Array.isArray(data?.comments) ? data.comments : [];
        } catch (err) {
            console.error('Load comments error:', err);
            this.comments = [];
        }
    }

    // Render — only called on initial mount.
    // After that, mutations are applied directly to the DOM.
    _render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="comment-section" data-comment-root>
                <h3>Comments (<span id="comment-count">${this.comments.length}</span>)</h3>

                <div class="comment-input">
                    <textarea id="comment-text"
                              placeholder="Write a comment..."
                              rows="2"
                              maxlength="2000"
                              aria-label="Write a comment"></textarea>
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <small id="comment-char-count" style="color:#888;">0 / 2000</small>
                        <button class="btn-primary" type="button" id="submit-comment">Post Comment</button>
                    </div>
                </div>

                <div class="comments-list" id="comments-list">
                    ${this._renderComments()}
                </div>
            </div>
        `;
    }

    _renderComments() {
        if (this.comments.length === 0) {
            return '<div class="empty-state">No comments yet. Be the first to comment!</div>';
        }
        return this.comments.map(c => this._renderComment(c)).join('');
    }

    _renderComment(comment) {
        const username = this._escapeHtml(comment.user?.username || 'Anonymous');
        const content = this._escapeHtml(comment.content || '');
        const time = this._formatTime(comment.createdAt);
        const likes = Number(comment.likes?.length || comment.likeCount || 0);
        const safeId = this._escapeHtml(comment._id);
        const isLoggedIn = Boolean(window.authService?.isAuthenticated?.());
        const avatar = this._safeAvatarUrl(comment.user?.avatar);

        const repliesHtml = (comment.replies || []).map(reply => {
            const ru = this._escapeHtml(reply.user?.username || 'Anonymous');
            const rc = this._escapeHtml(reply.content || '');
            const rt = this._formatTime(reply.createdAt);
            const rav = this._safeAvatarUrl(reply.user?.avatar);
            return `
                <div class="comment-item reply">
                    <div class="comment-avatar">
                        <img alt="${ru}" data-fallback-avatar data-src="${this._escapeHtml(rav)}">
                    </div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">${ru}</span>
                            <span class="comment-time">${rt}</span>
                        </div>
                        <div class="comment-text">${rc}</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="comment-item" data-comment-id="${safeId}">
                <div class="comment-avatar">
                    <img alt="${username}" data-fallback-avatar data-src="${this._escapeHtml(avatar)}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${username}</span>
                        <span class="comment-time">${time}</span>
                    </div>
                    <div class="comment-text">${content}</div>
                    <div class="comment-actions">
                        <button class="comment-like-btn" type="button" data-action="like" data-id="${safeId}">
                            <i class="far fa-heart"></i>
                            <span class="comment-like-count">${likes}</span>
                        </button>
                        <button class="comment-reply-btn" type="button" data-action="reply" data-id="${safeId}">Reply</button>
                        ${isLoggedIn ? `<button class="comment-report-btn" type="button" data-action="report" data-id="${safeId}">Report</button>` : ''}
                    </div>
                    ${repliesHtml ? `<div class="comment-replies">${repliesHtml}</div>` : ''}
                </div>
            </div>
        `;
    }

    _attachListeners() {
        const root = this.container.querySelector('[data-comment-root]');
        if (!root) return;

        // Submit button + Enter key
        const submitBtn = document.getElementById('submit-comment');
        const textarea = document.getElementById('comment-text');
        const counter = document.getElementById('comment-char-count');

        if (submitBtn) submitBtn.addEventListener('click', () => this._submit());
        if (textarea) {
            textarea.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._submit();
                }
            });
            textarea.addEventListener('input', () => {
                if (counter) counter.textContent = `${textarea.value.length} / 2000`;
            });
        }

        // Delegated handler for comment actions (one listener for whole list)
        root.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) return;
            const action = actionEl.dataset.action;
            const id = actionEl.dataset.id;
            switch (action) {
                case 'like': return this._likeComment(id, actionEl);
                case 'reply': return this._reply(id);
                case 'report': return this._reportComment(id, actionEl);
            }
        });

        // Wire avatar fallbacks
        root.querySelectorAll('[data-fallback-avatar]').forEach(img => this._wireAvatar(img));
    }

    _wireAvatar(img) {
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';
        const src = img.getAttribute('data-src');
        img.src = src || fallback;
        img.addEventListener('error', () => { img.src = fallback; }, { once: true });
    }

    // Actions
    async _submit() {
        if (this.isPosting) return;

        if (!window.authService?.isAuthenticated?.()) {
            Toast.show('Please login to comment', 'warning');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        const textarea = document.getElementById('comment-text');
        const content = (textarea?.value || '').trim();
        if (!content) return;

        if (content.length > 2000) {
            Toast.show('Comment is too long (max 2000 characters)', 'warning');
            return;
        }

        const submitBtn = document.getElementById('submit-comment');
        this.isPosting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';
        }

        const result = await window.authService.api._request(this.commentsPath, {
            method: 'POST',
            body: JSON.stringify({ songId: this.songId, content })
        });

        this.isPosting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Comment';
        }

        if (!result.ok) {
            const errMsg = result.data?.error || 'Failed to post comment';
            const status = result.status;
            if (status === 429) {
                Toast.show('Slow down — please wait a moment before posting again.', 'warning');
            } else {
                Toast.show(errMsg, 'error');
            }
            return;
        }

        // Optimistic insertion: prepend the new comment to the list.
        const newComment = result.data?.comment || {
            _id: result.data?._id || `tmp_${Date.now()}`,
            content,
            user: window.authService.getUser(),
            createdAt: new Date().toISOString(),
            likes: []
        };
        this.comments.unshift(newComment);

        // Update count
        const countEl = document.getElementById('comment-count');
        if (countEl) countEl.textContent = String(this.comments.length);

        // Insert the new comment node at the top of the list
        const list = document.getElementById('comments-list');
        if (list) {
            // If list currently shows the empty state, replace it.
            const empty = list.querySelector('.empty-state');
            if (empty) list.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.innerHTML = this._renderComment(newComment);
            const node = wrapper.firstElementChild;
            if (node) {
                list.insertBefore(node, list.firstChild);
                // Wire its avatar
                node.querySelectorAll('[data-fallback-avatar]').forEach(img => this._wireAvatar(img));
            }
        }

        textarea.value = '';
        const counter = document.getElementById('comment-char-count');
        if (counter) counter.textContent = '0 / 2000';
        Toast.show('Comment posted!', 'success');
    }

    async _likeComment(commentId, btnEl) {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show('Please login to like comments', 'warning');
            return;
        }
        if (!commentId || !btnEl) return;

        // Optimistic flip of the counter.
        const countSpan = btnEl.querySelector('.comment-like-count');
        const currentCount = parseInt(countSpan?.textContent || '0', 10);
        const wasLiked = btnEl.classList.contains('liked');
        const nextCount = wasLiked ? currentCount - 1 : currentCount + 1;

        btnEl.classList.toggle('liked');
        if (countSpan) countSpan.textContent = String(Math.max(0, nextCount));
        const icon = btnEl.querySelector('i');
        if (icon) icon.className = wasLiked ? 'far fa-heart' : 'fas fa-heart';

        const result = await window.authService.api._request(
            `${this.commentsPath}/${encodeURIComponent(commentId)}/like`,
            { method: 'POST' }
        );

        if (!result.ok) {
            // Revert
            btnEl.classList.toggle('liked');
            if (countSpan) countSpan.textContent = String(currentCount);
            if (icon) icon.className = wasLiked ? 'fas fa-heart' : 'far fa-heart';
            Toast.show(result.data?.error || 'Failed to update like', 'error');
        }
    }

    _reply(commentId) {
        // Phase 1: focus the main textarea with a "@user" prefix.
        // (Full nested-reply UI is a larger feature — flagged.)
        const comment = this.comments.find(c => c._id === commentId);
        if (!comment) return;
        const textarea = document.getElementById('comment-text');
        if (!textarea) return;
        const username = comment.user?.username || 'user';
        textarea.value = `@${username} ` + textarea.value;
        textarea.focus();
        const counter = document.getElementById('comment-char-count');
        if (counter) counter.textContent = `${textarea.value.length} / 2000`;
    }

    _reportComment(commentId, btnEl) {
        if (!commentId || !btnEl) return;
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show('Please login to report comments', 'warning');
            return;
        }

        const handle = Modal.show({
            title: 'Report Comment',
            content: `
                <form id="report-form">
                    <div class="form-group">
                        <label for="report-reason">Reason for reporting</label>
                        <select id="report-reason" required>
                            <option value="">Select reason</option>
                            <option value="spam">Spam</option>
                            <option value="harassment">Harassment</option>
                            <option value="hate_speech">Hate speech</option>
                            <option value="inappropriate">Inappropriate content</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div id="report-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Report', class: 'btn-danger', action: 'report' }
            ]
        });

        requestAnimationFrame(() => {
            const reportBtn = handle?.element?.querySelector('[data-action="report"]');
            if (!reportBtn) return;
            reportBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const reason = document.getElementById('report-reason')?.value || '';
                const errorEl = document.getElementById('report-error');
                if (!reason) {
                    if (errorEl) errorEl.textContent = 'Please select a reason';
                    return;
                }

                reportBtn.disabled = true;
                reportBtn.textContent = 'Reporting...';

                const result = await window.authService.api._request(
                    `${this.commentsPath}/${encodeURIComponent(commentId)}/report`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ reason })
                    }
                );

                if (!result.ok) {
                    if (errorEl) errorEl.textContent = result.data?.error || 'Failed to report';
                    reportBtn.disabled = false;
                    reportBtn.textContent = 'Report';
                    return;
                }

                handle?.close?.();
                Toast.show('Comment reported. Thank you.', 'success');
            });
        });
    }

    // Helpers
    _safeAvatarUrl(url) {
        if (!url) return window.getDefaultImage?.() || '/js/images/bravo.png';
        // Don't trust arbitrary javascript: data: URIs as image src.
        // <img> won't execute javascript: in modern browsers, but
        // refuse anyway. http/https/relative paths are fine.
        if (/^javascript:/i.test(url) || /^data:text/i.test(url)) {
            return window.getDefaultImage?.() || '/js/images/bravo.png';
        }
        return url;
    }

    _formatTime(date) {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        if (diff < 60_000) return 'Just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
        return d.toLocaleDateString();
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.CommentSection = CommentSection;
