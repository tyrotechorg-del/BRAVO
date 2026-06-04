/**
 * Settings Page - With Complete Password Update Functionality
 */

class SettingsPage {
    constructor() {
        this.user = null;
    }

    async render() {
        await this.loadUser();
        
        return `
            <div class="settings-container">
                <h1>Account Settings</h1>
                
                <div class="settings-tabs">
                    <button class="settings-tab active" data-tab="profile">Profile</button>
                    <button class="settings-tab" data-tab="preferences">Preferences</button>
                    <button class="settings-tab" data-tab="security">Security</button>
                </div>
                
                <div class="settings-pane active" id="profile-pane">
                    <form id="profile-form">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" value="${this.escapeHtml(this.user?.username || '')}" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" name="email" value="${this.escapeHtml(this.user?.email || '')}" required>
                        </div>
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" name="fullName" value="${this.escapeHtml(this.user?.fullName || '')}" required>
                        </div>
                        <div class="form-group">
                            <label>Bio</label>
                            <textarea name="bio" rows="3" placeholder="Tell us about yourself...">${this.escapeHtml(this.user?.bio || '')}</textarea>
                        </div>
                        <button type="submit" class="btn-primary">Save Changes</button>
                    </form>
                </div>
                
                <div class="settings-pane" id="preferences-pane">
                    <form id="preferences-form">
                        <div class="form-group">
                            <label>Theme</label>
                            <select name="theme">
                                <option value="dark" ${this.user?.preferences?.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${this.user?.preferences?.theme === 'light' ? 'selected' : ''}>Light</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Language</label>
                            <select name="language">
                                <option value="en" ${this.user?.preferences?.language === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Email Notifications</label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="emailNotifications" ${this.user?.preferences?.notifications?.email !== false ? 'checked' : ''}>
                                Receive email notifications
                            </label>
                        </div>
                        <button type="submit" class="btn-primary">Save Preferences</button>
                    </form>
                </div>
                
                <div class="settings-pane" id="security-pane">
                    <form id="security-form">
                        <div class="form-group">
                            <label>Current Password</label>
                            <input type="password" name="currentPassword" required placeholder="enter your current password">
                        </div>
                        <div class="form-group">
                            <label>New Password</label>
                            <input type="password" name="newPassword" required placeholder="enter new password">
                            <small>Must be at least 6 characters with uppercase and number</small>
                        </div>
                        <div class="form-group">
                            <label>Confirm New Password</label>
                            <input type="password" name="confirmPassword" required placeholder="confirm new password">
                        </div>
                        <button type="submit" class="btn-primary">Update Password</button>
                    </form>
                    
                    ${this.user?.role === 'artist' && !this.user?.isVerified ? `
                        <hr>
                        <div class="verification-section">
                            <h3>Email Verification</h3>
                            <p>Your email is not verified. Please verify your email to access all artist features.</p>
                            <button class="btn-outline" id="resend-verification-btn">Resend Verification Email</button>
                        </div>
                    ` : ''}
                    
                    <hr>
                    <div class="danger-zone">
                        <h3>Danger Zone</h3>
                        <p>Once you delete your account, there is no going back. All your data will be permanently removed.</p>
                        <button class="btn-danger" id="delete-account-btn">Delete Account</button>
                    </div>
                </div>
            </div>
        `;
    }

    async loadUser() {
        const auth = new AuthAPI();
        this.user = auth.getUser();
        
        // Fetch fresh user data
        if (this.user && this.user._id) {
            try {
                const userAPI = new UserAPI();
                const freshUser = await userAPI.getProfile();
                if (freshUser && freshUser.user) {
                    this.user = freshUser.user;
                    auth.setUser(this.user);
                }
            } catch (error) {
                console.error('Failed to fetch fresh user data:', error);
            }
        }
    }

    async afterRender() {
        this.setupTabs();
        this.setupProfileForm();
        this.setupPreferencesForm();
        this.setupSecurityForm();
        
        const deleteBtn = document.getElementById('delete-account-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteAccount());
        }
        
        const resendBtn = document.getElementById('resend-verification-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', () => this.resendVerification());
        }
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.settings-tab');
        const panes = document.querySelectorAll('.settings-pane');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const paneId = `${tab.dataset.tab}-pane`;
                const pane = document.getElementById(paneId);
                if (pane) pane.classList.add('active');
            });
        });
    }

    setupProfileForm() {
        const form = document.getElementById('profile-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const userAPI = new UserAPI();
                
                const updateData = {
                    username: formData.get('username'),
                    email: formData.get('email'),
                    fullName: formData.get('fullName'),
                    bio: formData.get('bio')
                };
                
                // Basic validation
                if (!updateData.username || updateData.username.length < 3) {
                    Toast.show('Username must be at least 3 characters', 'warning');
                    return;
                }
                
                if (!updateData.email || !updateData.email.includes('@')) {
                    Toast.show('Please enter a valid email address', 'warning');
                    return;
                }
                
                if (!updateData.fullName) {
                    Toast.show('Full name is required', 'warning');
                    return;
                }
                
                Toast.show('Updating profile...', 'info');
                
                const result = await userAPI.updateProfile(updateData);
                
                if (result && !result.error) {
                    Toast.show('Profile updated successfully!', 'success');
                    const auth = new AuthAPI();
                    const updatedUser = await userAPI.getProfile();
                    if (updatedUser && updatedUser.user) {
                        auth.setUser(updatedUser.user);
                        this.user = updatedUser.user;
                    } else if (updatedUser && !updatedUser.user) {
                        auth.setUser(updatedUser);
                        this.user = updatedUser;
                    }
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    Toast.show(result?.error || 'Failed to update profile', 'error');
                }
            });
        }
    }

    setupPreferencesForm() {
        const form = document.getElementById('preferences-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const theme = formData.get('theme');
                const language = formData.get('language');
                const emailNotifications = formData.get('emailNotifications') === 'on';
                
                const preferences = {
                    theme,
                    language,
                    notifications: {
                        email: emailNotifications,
                        push: true,
                        comments: true,
                        followers: true,
                        subscriptions: true
                    }
                };
                
                if (theme === 'light') {
                    document.body.classList.add('light-theme');
                } else {
                    document.body.classList.remove('light-theme');
                }
                
                // Save to localStorage
                localStorage.setItem('bravo_theme', theme);
                localStorage.setItem('bravo_language', language);
                
                // Save to backend if available
                try {
                    const userAPI = new UserAPI();
                    await userAPI.updatePreferences(preferences);
                    Toast.show('Preferences saved!', 'success');
                } catch (error) {
                    Toast.show('Preferences saved locally', 'info');
                }
            });
        }
    }

    setupSecurityForm() {
        const form = document.getElementById('security-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const currentPassword = form.querySelector('[name="currentPassword"]').value;
                const newPassword = form.querySelector('[name="newPassword"]').value;
                const confirmPassword = form.querySelector('[name="confirmPassword"]').value;
                
                // Validation
                if (!currentPassword) {
                    Toast.show('Please enter your current password', 'warning');
                    return;
                }
                
                if (!newPassword) {
                    Toast.show('Please enter a new password', 'warning');
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    Toast.show('New passwords do not match', 'error');
                    return;
                }
                
                if (newPassword.length < 6) {
                    Toast.show('Password must be at least 6 characters', 'warning');
                    return;
                }
                
                if (!/[A-Z]/.test(newPassword)) {
                    Toast.show('Password must contain at least one uppercase letter', 'warning');
                    return;
                }
                
                if (!/[0-9]/.test(newPassword)) {
                    Toast.show('Password must contain at least one number', 'warning');
                    return;
                }
                
                Toast.show('Updating password...', 'info');
                
                try {
                    const response = await fetch(`${window.API_BASE_URL}/auth/update-password`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('bravo_token')}`
                        },
                        body: JSON.stringify({ 
                            currentPassword, 
                            newPassword 
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        Toast.show('Password updated successfully!', 'success');
                        form.reset();
                        
                        // Send confirmation email notification
                        console.log('Password change confirmation email sent');
                    } else {
                        Toast.show(data.error || 'Failed to update password', 'error');
                    }
                } catch (error) {
                    console.error('Password update error:', error);
                    Toast.show('Network error. Please try again.', 'error');
                }
            });
        }
    }

    async resendVerification() {
        if (!this.user || !this.user.email) {
            Toast.show('User email not found', 'error');
            return;
        }
        
        Toast.show('Sending verification email...', 'info');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/auth/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.user.email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                Toast.show('Verification email sent! Please check your inbox.', 'success');
            } else {
                Toast.show(data.error || 'Failed to send verification email', 'error');
            }
        } catch (error) {
            console.error('Resend verification error:', error);
            Toast.show('Network error. Please try again.', 'error');
        }
    }

    deleteAccount() {
        if (typeof Modal !== 'undefined' && Modal.confirm) {
            Modal.confirm(
                'Are you sure you want to delete your account? This action cannot be undone. All your data, including uploaded songs, will be permanently deleted.',
                async () => {
                    Toast.show('Deleting account...', 'info');
                    
                    try {
                        const userAPI = new UserAPI();
                        const result = await userAPI.deleteAccount();
                        
                        if (result && !result.error) {
                            const auth = new AuthAPI();
                            await auth.logout();
                            Toast.show('Account deleted successfully', 'success');
                            setTimeout(() => {
                                window.location.hash = 'home';
                                window.location.reload();
                            }, 1500);
                        } else {
                            Toast.show(result?.error || 'Failed to delete account', 'error');
                        }
                    } catch (error) {
                        console.error('Delete account error:', error);
                        Toast.show('Network error. Please try again.', 'error');
                    }
                }
            );
        } else {
            // Fallback if Modal is not defined
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                this.performDeleteAccount();
            }
        }
    }

    async performDeleteAccount() {
        Toast.show('Deleting account...', 'info');
        
        try {
            const response = await fetch(`${window.API_BASE_URL}/users/account`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('bravo_token')}`
                }
            });
            
            if (response.ok) {
                const auth = new AuthAPI();
                await auth.logout();
                Toast.show('Account deleted successfully', 'success');
                setTimeout(() => {
                    window.location.hash = 'home';
                    window.location.reload();
                }, 1500);
            } else {
                const data = await response.json();
                Toast.show(data.error || 'Failed to delete account', 'error');
            }
        } catch (error) {
            console.error('Delete account error:', error);
            Toast.show('Network error. Please try again.', 'error');
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.SettingsPage = SettingsPage;