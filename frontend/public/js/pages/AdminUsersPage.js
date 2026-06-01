/**
 * Admin Users Page - User Management
 */

class AdminUsersPage {
    constructor() {
        this.users = [];
        this.isLoading = false;
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchTerm = '';
        this.roleFilter = '';
        this.apiUrl = window.API_BASE_URL;
        this.staticUrl = window.APP_CONFIG.STATIC_URL;
    }

    async render() {
        await this.loadData();
        
        return `
            <div class="admin-users-page">
                <div class="page-header">
                    <h1><i class="fas fa-users"></i> User Management</h1>
                    <p>View and manage all platform users</p>
                </div>
                
                <div class="filters-bar">
                    <div class="search-box">
                        <input type="text" id="user-search" placeholder="Search by username or email..." value="${this.escapeHtml(this.searchTerm)}">
                        <button id="search-btn" class="btn-secondary"><i class="fas fa-search"></i> Search</button>
                    </div>
                    <div class="filter-box">
                        <select id="role-filter">
                            <option value="">All Roles</option>
                            <option value="listener" ${this.roleFilter === 'listener' ? 'selected' : ''}>Listeners</option>
                            <option value="artist" ${this.roleFilter === 'artist' ? 'selected' : ''}>Artists</option>
                            <option value="admin" ${this.roleFilter === 'admin' ? 'selected' : ''}>Admins</option>
                        </select>
                        <button id="filter-btn" class="btn-secondary"><i class="fas fa-filter"></i> Filter</button>
                        <button id="reset-btn" class="btn-outline"><i class="fas fa-undo"></i> Reset</button>
                    </div>
                </div>
                
                <div class="users-container">
                    ${this.renderContent()}
                </div>
            </div>
        `;
    }

    async loadData() {
        this.isLoading = true;
        try {
            const adminAPI = new AdminAPI();
            const result = await adminAPI.getAllUsers(this.currentPage, 20, this.roleFilter, this.searchTerm);
            if (!result.error) {
                this.users = result.users || [];
                this.totalPages = result.totalPages || 1;
            } else {
                this.users = [];
            }
        } catch (error) {
            console.error('Load users error:', error);
            this.users = [];
        } finally {
            this.isLoading = false;
        }
    }

    renderContent() {
        if (this.isLoading) {
            return '<div class="loading-container"><div class="spinner"></div><p>Loading users...</p></div>';
        }
        
        if (this.users.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Users Found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                </div>
            `;
        }
        
        return `
            <div class="users-table-container">
                <table class="data-table">
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
                    <tbody>
                        ${this.users.map(user => `
                            <tr data-user-id="${user._id}">
                                <td><img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'}" class="user-avatar-sm" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=32'"></td>
                                <td><strong>${this.escapeHtml(user.username)}</strong></td>
                                <td>${this.escapeHtml(user.email)}</td>
                                <td>${this.escapeHtml(user.fullName)}</td>
                                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                                <td><span class="status-badge ${user.isActive ? 'active' : 'inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                <td class="actions-cell">
                                    <button class="btn-icon edit-user" data-id="${user._id}" title="Edit User">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-icon view-user" data-id="${user._id}" title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn-icon delete-user ${user.role === 'admin' ? 'disabled' : ''}" data-id="${user._id}" title="Delete User" ${user.role === 'admin' ? 'disabled' : ''}>
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${this.renderPagination()}
            </div>
        `;
    }

    renderPagination() {
        if (this.totalPages <= 1) return '';
        
        let html = '<div class="pagination-controls">';
        if (this.currentPage > 1) {
            html += `<button class="page-btn" data-page="${this.currentPage - 1}"><i class="fas fa-chevron-left"></i> Previous</button>`;
        }
        html += `<span class="page-info">Page ${this.currentPage} of ${this.totalPages}</span>`;
        if (this.currentPage < this.totalPages) {
            html += `<button class="page-btn" data-page="${this.currentPage + 1}">Next <i class="fas fa-chevron-right"></i></button>`;
        }
        html += '</div>';
        
        return html;
    }

    async afterRender() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Search button
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('user-search');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                this.searchTerm = searchInput?.value || '';
                this.currentPage = 1;
                await this.loadData();
                await this.render();
                await this.afterRender();
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    this.searchTerm = searchInput.value;
                    this.currentPage = 1;
                    await this.loadData();
                    await this.render();
                    await this.afterRender();
                }
            });
        }
        
        // Filter button
        const filterBtn = document.getElementById('filter-btn');
        const roleFilter = document.getElementById('role-filter');
        
        if (filterBtn) {
            filterBtn.addEventListener('click', async () => {
                this.roleFilter = roleFilter?.value || '';
                this.currentPage = 1;
                await this.loadData();
                await this.render();
                await this.afterRender();
            });
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                this.searchTerm = '';
                this.roleFilter = '';
                this.currentPage = 1;
                if (searchInput) searchInput.value = '';
                if (roleFilter) roleFilter.value = '';
                await this.loadData();
                await this.render();
                await this.afterRender();
                Toast.show('Filters reset', 'info');
            });
        }
        
        // Edit user
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const userId = btn.dataset.id;
                await this.showEditUserModal(userId);
            });
        });
        
        // View user
        document.querySelectorAll('.view-user').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const userId = btn.dataset.id;
                await this.showUserDetailsModal(userId);
            });
        });
        
        // Delete user
        document.querySelectorAll('.delete-user:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const userId = btn.dataset.id;
                Modal.confirm('Are you sure you want to delete this user? This action cannot be undone.', async () => {
                    const adminAPI = new AdminAPI();
                    const result = await adminAPI.deleteUser(userId);
                    if (!result.error) {
                        Toast.show('User deleted successfully', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                });
            });
        });
        
        // Pagination
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                this.currentPage = parseInt(btn.dataset.page);
                await this.loadData();
                await this.render();
                await this.afterRender();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    async showEditUserModal(userId) {
        const adminAPI = new AdminAPI();
        const userData = await adminAPI.getUserDetails(userId);
        const user = userData.user || {};
        
        Modal.show({
            title: `Edit User: ${user.username}`,
            content: `
                <form id="edit-user-form">
                    <div class="form-group">
                        <label>Status</label>
                        <select name="isActive" id="edit-status">
                            <option value="true" ${user.isActive ? 'selected' : ''}>Active</option>
                            <option value="false" ${!user.isActive ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select name="role" id="edit-role">
                            <option value="listener" ${user.role === 'listener' ? 'selected' : ''}>Listener</option>
                            <option value="artist" ${user.role === 'artist' ? 'selected' : ''}>Artist</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    ${user.role === 'artist' ? `
                        <div class="form-group">
                            <label>Verify Artist</label>
                            <button type="button" id="verify-artist-btn" class="btn-outline">Verify Artist</button>
                        </div>
                        <div class="form-group">
                            <label>Feature Artist</label>
                            <button type="button" id="feature-artist-btn" class="btn-outline">Toggle Featured</button>
                        </div>
                    ` : ''}
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save Changes', class: 'btn-primary', action: 'save', onClick: async () => {
                    const isActive = document.getElementById('edit-status').value === 'true';
                    const role = document.getElementById('edit-role').value;
                    const result = await adminAPI.updateUserStatus(userId, isActive, role);
                    if (!result.error) {
                        Toast.show('User updated successfully', 'success');
                        await this.loadData();
                        await this.render();
                        await this.afterRender();
                    } else {
                        Toast.show(result.error, 'error');
                    }
                }}
            ]
        });
        
        setTimeout(() => {
            const verifyBtn = document.getElementById('verify-artist-btn');
            const featureBtn = document.getElementById('feature-artist-btn');
            
            if (verifyBtn) {
                verifyBtn.addEventListener('click', async () => {
                    const result = await adminAPI.verifyArtist(userId);
                    if (!result.error) {
                        Toast.show('Artist verified!', 'success');
                    } else {
                        Toast.show(result.error, 'error');
                    }
                });
            }
            
            if (featureBtn) {
                featureBtn.addEventListener('click', async () => {
                    const result = await adminAPI.featureArtist(userId);
                    if (!result.error) {
                        Toast.show('Artist featured status toggled', 'success');
                    } else {
                        Toast.show(result.error, 'error');
                    }
                });
            }
        }, 100);
    }

    async showUserDetailsModal(userId) {
        const adminAPI = new AdminAPI();
        const userData = await adminAPI.getUserDetails(userId);
        const user = userData.user || {};
        const stats = userData.stats || {};
        const artistProfile = userData.artistProfile;
        
        Modal.show({
            title: `User Details: ${user.username}`,
            content: `
                <div class="user-details" style="max-height: 500px; overflow-y: auto;">
                    <div class="detail-section">
                        <h4><i class="fas fa-user"></i> Account Information</h4>
                        <p><strong>Email:</strong> ${this.escapeHtml(user.email)}</p>
                        <p><strong>Full Name:</strong> ${this.escapeHtml(user.fullName)}</p>
                        <p><strong>Role:</strong> ${user.role}</p>
                        <p><strong>Status:</strong> ${user.isActive ? 'Active' : 'Inactive'}</p>
                        <p><strong>Verified:</strong> ${user.isVerified ? 'Yes' : 'No'}</p>
                        <p><strong>Joined:</strong> ${new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h4><i class="fas fa-chart-bar"></i> Statistics</h4>
                        <p><strong>Total Songs:</strong> ${stats.totalSongs || 0}</p>
                        <p><strong>Total Streams:</strong> ${stats.totalStreams || 0}</p>
                        <p><strong>Total Spent:</strong> K${(stats.totalSpent || 0).toFixed(2)}</p>
                    </div>
                    
                    ${artistProfile ? `
                        <div class="detail-section">
                            <h4><i class="fas fa-music"></i> Artist Profile</h4>
                            <p><strong>Stage Name:</strong> ${this.escapeHtml(artistProfile.stageName)}</p>
                            <p><strong>Genres:</strong> ${artistProfile.genres?.join(', ') || 'None'}</p>
                            <p><strong>Verified:</strong> ${artistProfile.verified ? 'Yes' : 'No'}</p>
                            <p><strong>Featured:</strong> ${artistProfile.featured ? 'Yes' : 'No'}</p>
                            <p><strong>Monthly Listeners:</strong> ${artistProfile.monthlyListeners?.toLocaleString() || 0}</p>
                            <p><strong>Total Revenue:</strong> K${(artistProfile.totalRevenue || 0).toFixed(2)}</p>
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

window.AdminUsersPage = AdminUsersPage;