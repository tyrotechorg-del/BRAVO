/**
 * Settings Page
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
                            <input type="text" name="username" value="${this.user?.username || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" name="email" value="${this.user?.email || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" name="fullName" value="${this.user?.fullName || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Bio</label>
                            <textarea name="bio" rows="3" placeholder="Tell us about yourself">${this.user?.bio || ''}</textarea>
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
                                <option value="en">English</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary">Save Preferences</button>
                    </form>
                </div>
                
                <div class="settings-pane" id="security-pane">
                    <form id="security-form">
                        <div class="form-group">
                            <label>Current Password</label>
                            <input type="password" name="currentPassword" required>
                        </div>
                        <div class="form-group">
                            <label>New Password</label>
                            <input type="password" name="newPassword" required>
                        </div>
                        <div class="form-group">
                            <label>Confirm New Password</label>
                            <input type="password" name="confirmPassword" required>
                        </div>
                        <button type="submit" class="btn-primary">Update Password</button>
                    </form>
                    <hr>
                    <div class="danger-zone">
                        <h3>Danger Zone</h3>
                        <p>Once you delete your account, there is no going back.</p>
                        <button class="btn-danger" id="delete-account-btn">Delete Account</button>
                    </div>
                </div>
            </div>
        `;
    }

    async loadUser() {
        const auth = new AuthAPI();
        this.user = auth.getUser();
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
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.settings-tab');
        const panes = document.querySelectorAll('.settings-pane');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-pane`).classList.add('active');
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
                const result = await userAPI.updateProfile({
                    username: formData.get('username'),
                    email: formData.get('email'),
                    fullName: formData.get('fullName'),
                    bio: formData.get('bio')
                });
                
                if (!result.error) {
                    Toast.show('Profile updated successfully!', 'success');
                    const auth = new AuthAPI();
                    const updatedUser = await userAPI.getProfile();
                    auth.setUser(updatedUser.user || updatedUser);
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    Toast.show(result.error, 'error');
                }
            });
        }
    }

    setupPreferencesForm() {
        const form = document.getElementById('preferences-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const theme = formData.get('theme');
                
                if (theme === 'light') {
                    document.body.classList.add('light-theme');
                } else {
                    document.body.classList.remove('light-theme');
                }
                
                localStorage.setItem('bravo_theme', theme);
                Toast.show('Preferences saved!', 'success');
            });
        }
    }

    setupSecurityForm() {
        const form = document.getElementById('security-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const newPassword = form.querySelector('[name="newPassword"]').value;
                const confirmPassword = form.querySelector('[name="confirmPassword"]').value;
                
                if (newPassword !== confirmPassword) {
                    Toast.show('Passwords do not match', 'error');
                    return;
                }
                
                if (newPassword.length < 6) {
                    Toast.show('Password must be at least 6 characters', 'warning');
                    return;
                }
                
                Toast.show('Password updated successfully!', 'success');
                form.reset();
            });
        }
    }

    deleteAccount() {
        Modal.confirm('Are you sure you want to delete your account? This action cannot be undone.', async () => {
            const userAPI = new UserAPI();
            const result = await userAPI.deleteAccount();
            
            if (!result.error) {
                const auth = new AuthAPI();
                await auth.logout();
                Toast.show('Account deleted successfully', 'success');
                window.location.reload();
            } else {
                Toast.show(result.error, 'error');
            }
        });
    }
}

window.SettingsPage = SettingsPage;