

class AdminUsersPage {
    constructor() {
        this.users = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchTerm = '';
        this.roleFilter = '';
        this.adminAPI = new AdminAPI();
        this.staticUrl = window.APP_CONFIG?.STATIC_URL || window.location.origin;
        this.loading = true;
    }

    async render() {
        return `
            <div class="admin-users-page">
                <div class="page-header">
                    <h1><i class="fas fa-users"></i> User Management</h1>
                    <p>View and manage all platform users.</p>
                </div>

                <div class="filters-bar" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                    <input type="text" id="user-search" placeholder="Search username or email..." style="flex:1; min-width:200px;">
                    <select id="role-filter">
                        <option value="">All Roles</option>
                        <option value="listener">Listeners</option>
                        <option value="artist">Artists</option>
                        <option value="admin">Admins</option>
                    </select>
                    <button class="btn-secondary" type="button" id="apply-filters-btn">
                        <i class="fas fa-filter"></i> Apply
                    </button>
                    <button class="btn-outline" type="button" id="reset-filters-btn">
                        <i class="fas fa-undo"></i> Reset
                    </button>
                </div>

                <div class="users-container" id="users-container" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div class="pagination" id="users-pagination"></div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAdmin?.()) {
            Toast.show?.('Admin access required', 'error');
            return;
        }
        this._populateFilters();
        this._wireFilters();
        await this._loadData();
        this._renderTable();
        this._renderPagination();
    }

    _populateFilters() {
        const search = document.getElementById('user-search');
        const role = document.getElementById('role-filter');
        if (search) search.value = this.searchTerm;
        if (role) role.value = this.roleFilter;
    }

    _wireFilters() {
        const apply = async () => {
            const search = document.getElementById('user-search');
            const role = document.getElementById('role-filter');
            this.searchTerm = search?.value.trim() || '';
            this.roleFilter = role?.value || '';
            this.currentPage = 1;
            await this._loadData();
            this._renderTable();
            this._renderPagination();
        };

        document.getElementById('apply-filters-btn')?.addEventListener('click', apply);
        document.getElementById('user-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') apply();
        });
        document.getElementById('reset-filters-btn')?.addEventListener('click', async () => {
            const search = document.getElementById('user-search');
            const role = document.getElementById('role-filter');
            if (search) search.value = '';
            if (role) role.value = '';
            this.searchTerm = '';
            this.roleFilter = '';
            this.currentPage = 1;
            await this._loadData();
            this._renderTable();
            this._renderPagination();
        });
    }

    async _loadData() {
        this.loading = true;
        const result = await this.adminAPI.getAllUsers(
            this.currentPage, 20, this.roleFilter, this.searchTerm
        );
        if (result.success) {
            const data = result.data || {};
            this.users = data.users || [];
            this.totalPages = data.totalPages || 1;
        } else {
            this.users = [];
            this.totalPages = 1;
        }
        this.loading = false;
    }

    _renderTable() {
        const container = document.getElementById('users-container');
        if (!container) return;

        if (this.users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No users found</h3>
                    <p>Try adjusting your search or filter.</p>
                </div>
            `;
            return;
        }

        const me = window.authService?.getUser?.();
        const meId = me?._id;

        container.innerHTML = `
            <div class="users-table-container">
                <table class="data-table" id="users-table">
                    <thead>
                        <tr>
                            <th>Avatar</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Full Name</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody"></tbody>
                </table>
            </div>
        `;

        const tbody = document.getElementById('users-tbody');
        const fallback = window.getDefaultImage?.() || '/js/images/bravo.png';

        this.users.forEach(user => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-user-id', user._id);

            const safeUsername = this._escapeHtml(user.username || '');
            const safeEmail = this._escapeHtml(user.email || '');
            const safeFullName = this._escapeHtml(user.fullName || '—');
            const role = String(user.role || 'listener').toLowerCase();
            const safeRole = this._escapeHtml(role);
            const isActive = user.isActive !== false;
            const isSelf = String(user._id) === String(meId);
            const isAdminRow = role === 'admin';
            const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';

            tr.innerHTML = `
                <td><img class="user-avatar-sm" alt="${safeUsername}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;"></td>
                <td><strong>${safeUsername}</strong>${isSelf ? ' <span style="color:#888; font-size:11px;">(you)</span>' : ''}</td>
                <td>${safeEmail}</td>
                <td>${safeFullName}</td>
                <td><span class="role-badge role-${safeRole}">${safeRole}</span></td>
                <td><span class="status-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span></td>
                <td>${this._escapeHtml(joined)}</td>
                <td class="actions-cell">
                    <button class="btn-icon" type="button" data-action="edit" title="Edit" ${isSelf ? 'disabled' : ''} aria-label="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" type="button" data-action="view" title="View details" aria-label="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" type="button" data-action="delete" title="Delete" ${isAdminRow || isSelf ? 'disabled' : ''} aria-label="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            const img = tr.querySelector('.user-avatar-sm');
            if (img) {
                img.src = this._safeAvatarUrl(user.avatar) || fallback;
                img.addEventListener('error', () => { img.src = fallback; }, { once: true });
            }

            tbody.appendChild(tr);
        });

        // ONE delegated click handler for the whole table
        const table = document.getElementById('users-table');
        table?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn || btn.disabled) return;
            const row = btn.closest('[data-user-id]');
            if (!row) return;
            const userId = row.dataset.userId;
            const user = this.users.find(u => String(u._id) === String(userId));
            if (!user) return;
            const action = btn.dataset.action;
            if (action === 'edit') this._showEditModal(user, row);
            else if (action === 'view') this._showDetailsModal(user);
            else if (action === 'delete') this._confirmDelete(user, row);
        });
    }

    _renderPagination() {
        const container = document.getElementById('users-pagination');
        if (!container) return;
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        const prevDisabled = this.currentPage <= 1;
        const nextDisabled = this.currentPage >= this.totalPages;
        container.innerHTML = `
            <div class="pagination-controls">
                <button class="page-btn" type="button" data-action="prev" ${prevDisabled ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>
                <button class="page-btn" type="button" data-action="next" ${nextDisabled ? 'disabled' : ''}>
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
            await this._loadData();
            this._renderTable();
            this._renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, { once: true });
    }

    // Edit modal
    _showEditModal(user, rowEl) {
        const handle = Modal.show({
            title: 'Edit User',
            content: `
                <p style="margin-bottom:12px;"><strong>${this._escapeHtml(user.username || '')}</strong></p>
                <form id="edit-user-form" novalidate>
                    <div class="form-group">
                        <label for="eu-status">Status</label>
                        <select id="eu-status">
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="eu-role">Role</label>
                        <select id="eu-role">
                            <option value="listener">Listener</option>
                            <option value="artist">Artist</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div id="eu-artist-actions" hidden>
                        <hr>
                        <p>Artist actions</p>
                        <button type="button" class="btn-outline" id="eu-verify-btn">
                            <i class="fas fa-check-circle"></i> Toggle Verification
                        </button>
                        <button type="button" class="btn-outline" id="eu-feature-btn" style="margin-left:8px;">
                            <i class="fas fa-star"></i> Toggle Featured
                        </button>
                    </div>
                    <div id="eu-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save Changes', class: 'btn-primary', action: 'save' }
            ]
        });

        requestAnimationFrame(() => {
            const statusSel = document.getElementById('eu-status');
            const roleSel = document.getElementById('eu-role');
            if (statusSel) statusSel.value = user.isActive !== false ? 'true' : 'false';
            if (roleSel) roleSel.value = user.role || 'listener';

            // Artist actions panel only for artists.
            const artistActions = document.getElementById('eu-artist-actions');
            if (artistActions && user.role === 'artist') {
                artistActions.hidden = false;

                // Look up the artist._id (not the user._id) — the backend
                this.adminAPI.getUserDetails(user._id).then(detail => {
                    if (!detail.success) return;
                    const artistId = detail.data?.artistProfile?._id;
                    if (!artistId) return;

                    document.getElementById('eu-verify-btn')?.addEventListener('click', async () => {
                        const isVerified = detail.data.artistProfile.verified;
                        const result = isVerified
                            ? await this.adminAPI.unverifyArtist(artistId)
                            : await this.adminAPI.verifyArtist(artistId);
                        if (result.success) {
                            Toast.show?.(isVerified ? 'Artist unverified' : 'Artist verified', 'success');
                        } else {
                            Toast.show?.(result.error || 'Failed', 'error');
                        }
                    });

                    document.getElementById('eu-feature-btn')?.addEventListener('click', async () => {
                        const featured = !detail.data.artistProfile.featured;
                        const result = await this.adminAPI.featureArtist(artistId, featured);
                        if (result.success) {
                            Toast.show?.(featured ? 'Artist featured' : 'Artist un-featured', 'success');
                        } else {
                            Toast.show?.(result.error || 'Failed', 'error');
                        }
                    });
                });
            }

            const saveBtn = handle?.element?.querySelector('[data-action="save"]');
            saveBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._submitEdit(user, rowEl, handle);
            });
        });
    }

    async _submitEdit(user, rowEl, handle) {
        const errorEl = document.getElementById('eu-error');
        errorEl.textContent = '';
        const isActive = document.getElementById('eu-status').value === 'true';
        const role = document.getElementById('eu-role').value;

        const saveBtn = handle?.element?.querySelector('[data-action="save"]');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        const result = await this.adminAPI.updateUserStatus(user._id, isActive, role);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }

        if (!result.success) {
            errorEl.textContent = result.error || 'Failed to update';
            return;
        }

        // Update local model + the row's badges in place
        const idx = this.users.findIndex(u => u._id === user._id);
        if (idx >= 0) {
            this.users[idx] = { ...this.users[idx], isActive, role };
        }
        if (rowEl) {
            const statusBadge = rowEl.querySelector('.status-badge');
            const roleBadge = rowEl.querySelector('.role-badge');
            if (statusBadge) {
                statusBadge.className = `status-badge ${isActive ? 'active' : 'inactive'}`;
                statusBadge.textContent = isActive ? 'Active' : 'Inactive';
            }
            if (roleBadge) {
                roleBadge.className = `role-badge role-${role}`;
                roleBadge.textContent = role;
            }
        }

        handle?.close?.();
        Toast.show?.('User updated', 'success');
    }

    // Details modal
    async _showDetailsModal(user) {
        // Fetch full details (including stats + artistProfile)
        const result = await this.adminAPI.getUserDetails(user._id);
        if (!result.success) {
            Toast.show?.(result.error || 'Failed to load details', 'error');
            return;
        }
        const data = result.data || {};
        const u = data.user || user;
        const stats = data.stats || {};
        const artistProfile = data.artistProfile;

        const safeStageName = artistProfile ? this._escapeHtml(artistProfile.stageName || '') : '';
        const safeGenres = artistProfile && Array.isArray(artistProfile.genres)
            ? this._escapeHtml(artistProfile.genres.join(', '))
            : '';

        Modal.show({
            title: 'User Details',
            content: `
                <div class="user-details" style="max-height: 500px; overflow-y: auto;">
                    <div class="detail-section">
                        <h4><i class="fas fa-user"></i> Account</h4>
                        <p><strong>Username:</strong> ${this._escapeHtml(u.username || '')}</p>
                        <p><strong>Email:</strong> ${this._escapeHtml(u.email || '')}</p>
                        <p><strong>Full Name:</strong> ${this._escapeHtml(u.fullName || '—')}</p>
                        <p><strong>Role:</strong> ${this._escapeHtml(u.role || 'listener')}</p>
                        <p><strong>Status:</strong> ${u.isActive !== false ? 'Active' : 'Inactive'}</p>
                        <p><strong>Verified:</strong> ${u.isVerified ? 'Yes' : 'No'}</p>
                        <p><strong>Joined:</strong> ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</p>
                    </div>

                    <div class="detail-section">
                        <h4><i class="fas fa-chart-bar"></i> Activity</h4>
                        <p><strong>Total Songs:</strong> ${this._formatNumber(stats.totalSongs || 0)}</p>
                        <p><strong>Total Streams:</strong> ${this._formatNumber(stats.totalStreams || 0)}</p>
                        <p><strong>Total Spent:</strong> K${Number(stats.totalSpent || 0).toFixed(2)}</p>
                    </div>

                    ${artistProfile ? `
                        <div class="detail-section">
                            <h4><i class="fas fa-music"></i> Artist Profile</h4>
                            <p><strong>Stage Name:</strong> ${safeStageName}</p>
                            <p><strong>Genres:</strong> ${safeGenres || 'None'}</p>
                            <p><strong>Verified:</strong> ${artistProfile.verified ? 'Yes' : 'No'}</p>
                            <p><strong>Featured:</strong> ${artistProfile.featured ? 'Yes' : 'No'}</p>
                            <p><strong>Monthly Listeners:</strong> ${this._formatNumber(artistProfile.monthlyListeners || 0)}</p>
                            <p><strong>Total Revenue:</strong> K${Number(artistProfile.totalRevenue || 0).toFixed(2)}</p>
                        </div>
                    ` : ''}
                </div>
            `,
            buttons: [{ text: 'Close', class: 'btn-secondary', action: 'close' }]
        });
    }

    _confirmDelete(user, rowEl) {
        const doDelete = async () => {
            const result = await this.adminAPI.deleteUser(user._id);
            if (!result.success) {
                Toast.show?.(result.error || 'Failed to delete', 'error');
                return;
            }
            this.users = this.users.filter(u => u._id !== user._id);
            if (rowEl?.parentNode) rowEl.parentNode.removeChild(rowEl);
            Toast.show?.('User deleted', 'success');
            if (this.users.length === 0) this._renderTable();
        };
        if (window.Modal?.confirm) {
            Modal.confirm(`Delete "${user.username}"? All their data will be removed.`, doDelete);
        } else if (confirm(`Delete "${user.username}"?`)) {
            doDelete();
        }
    }

    // Helpers
    _safeAvatarUrl(url) {
        if (!url || typeof url !== 'string') return null;
        if (/^javascript:/i.test(url) || /^data:text/i.test(url)) return null;
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads') || url.startsWith('/static')) {
            return `${this.staticUrl}${url}`;
        }
        return url;
    }

    _formatNumber(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
        return String(num || 0);
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AdminUsersPage = AdminUsersPage;
