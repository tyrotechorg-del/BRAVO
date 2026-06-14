

class SettingsPage {
    constructor() {
        this.user = null;
        this.activeTab = 'profile';
        this.userAPI = new UserAPI();
    }

    async render() {
        await this._loadUser();

        const safeRole = this._escapeHtml(this.user?.role || 'listener');
        const isUnverifiedArtist = this.user?.role === 'artist' && this.user?.isVerified === false;

        return `
            <div class="settings-container">
                <h1>Account Settings</h1>

                <div class="settings-tabs" role="tablist" aria-label="Settings tabs">
                    <button class="settings-tab active" type="button" role="tab" data-tab="profile" aria-selected="true">Profile</button>
                    <button class="settings-tab" type="button" role="tab" data-tab="preferences" aria-selected="false">Preferences</button>
                    <button class="settings-tab" type="button" role="tab" data-tab="security" aria-selected="false">Security</button>
                </div>

                <div class="settings-pane active" id="profile-pane" role="tabpanel">
                    <form id="profile-form" novalidate>
                        <div class="form-group">
                            <label for="settings-username">Username</label>
                            <input type="text" id="settings-username" required minlength="3" maxlength="30" autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label for="settings-email">Email</label>
                            <input type="email" id="settings-email" required autocomplete="email">
                        </div>
                        <div class="form-group">
                            <label for="settings-fullname">Full Name</label>
                            <input type="text" id="settings-fullname" required maxlength="100" autocomplete="name">
                        </div>
                        <div class="form-group">
                            <label for="settings-bio">Bio</label>
                            <textarea id="settings-bio" rows="3" maxlength="500" placeholder="Tell us about yourself..."></textarea>
                        </div>
                        <div id="profile-error" style="color:#ff4757; font-size:14px; margin-bottom:8px;"></div>
                        <button type="submit" class="btn-primary">Save Changes</button>
                    </form>
                </div>

                <div class="settings-pane" id="preferences-pane" role="tabpanel" hidden>
                    <form id="preferences-form" novalidate>
                        <div class="form-group">
                            <label for="settings-theme">Theme</label>
                            <select id="settings-theme">
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="settings-language">Language</label>
                            <select id="settings-language">
                                <option value="en">English</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="settings-email-notifications">
                                Receive email notifications
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="settings-push-notifications">
                                Receive push notifications
                            </label>
                        </div>
                        <button type="submit" class="btn-primary">Save Preferences</button>
                    </form>
                </div>

                <div class="settings-pane" id="security-pane" role="tabpanel" hidden>
                    <form id="security-form" novalidate>
                        <div class="form-group">
                            <label for="settings-current-pw">Current Password</label>
                            <input type="password" id="settings-current-pw" required autocomplete="current-password">
                        </div>
                        <div class="form-group">
                            <label for="settings-new-pw">New Password</label>
                            <input type="password" id="settings-new-pw" required autocomplete="new-password" minlength="8">
                            <small style="color:#888;">
                                At least 8 characters with uppercase, lowercase, number, and special character.
                            </small>
                        </div>
                        <div class="form-group">
                            <label for="settings-confirm-pw">Confirm New Password</label>
                            <input type="password" id="settings-confirm-pw" required autocomplete="new-password">
                        </div>
                        <div id="security-error" style="color:#ff4757; font-size:14px; margin-bottom:8px;"></div>
                        <button type="submit" class="btn-primary">Update Password</button>
                    </form>

                    ${isUnverifiedArtist ? `
                        <hr>
                        <div class="verification-section">
                            <h3>Email Verification</h3>
                            <p>Your email is not verified. Some artist features are limited until you verify.</p>
                            <button class="btn-outline" type="button" id="resend-verification-btn">Resend Verification Email</button>
                        </div>
                    ` : ''}

                    <hr>
                    <div class="danger-zone" style="border:1px solid #ff4757; padding:16px; border-radius:8px; margin-top:24px;">
                        <h3 style="color:#ff4757;">Danger Zone</h3>
                        <p>Deleting your account is permanent. All your data — including uploaded songs and earnings — will be removed.</p>
                        <p style="margin-top:8px; font-size:13px; color:#888;">
                            Your role: <strong>${safeRole}</strong>
                        </p>
                        <button class="btn-danger" type="button" id="delete-account-btn">Delete Account</button>
                    </div>
                </div>
            </div>
        `;
    }

    async _loadUser() {
        // Start with the cached user from authService.
        this.user = window.authService?.getUser?.() || null;

        // Fetch fresh user from server.
        if (this.user?._id) {
            const result = await this.userAPI.getProfile();
            if (result.success) {
                const freshUser = result.data?.user || result.data;
                if (freshUser && freshUser._id) {
                    this.user = freshUser;
                    window.authService?.setUser?.(freshUser);
                }
            }
        }
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in to access settings', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        this._populateProfile();
        this._populatePreferences();
        this._wireTabs();
        this._wireProfileForm();
        this._wirePreferencesForm();
        this._wireSecurityForm();
        this._wireDeleteAccount();
        this._wireResendVerification();
    }

    // Populate forms (no HTML interpolation with user values)
    _populateProfile() {
        const u = this.user || {};
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('settings-username', u.username);
        set('settings-email', u.email);
        set('settings-fullname', u.fullName);
        set('settings-bio', u.bio);
    }

    _populatePreferences() {
        const prefs = this.user?.preferences || {};
        const themeSel = document.getElementById('settings-theme');
        const langSel = document.getElementById('settings-language');
        const emailNotif = document.getElementById('settings-email-notifications');
        const pushNotif = document.getElementById('settings-push-notifications');

        const savedTheme = prefs.theme || localStorage.getItem('bravo_theme') || 'dark';
        const savedLang = prefs.language || localStorage.getItem('bravo_language') || 'en';

        if (themeSel) themeSel.value = savedTheme;
        if (langSel) langSel.value = savedLang;
        if (emailNotif) emailNotif.checked = prefs.notifications?.email !== false;
        if (pushNotif) pushNotif.checked = prefs.notifications?.push !== false;
    }

    // Tabs
    _wireTabs() {
        const tabs = document.querySelectorAll('.settings-tab');
        const panes = document.querySelectorAll('.settings-pane');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                panes.forEach(p => {
                    p.classList.remove('active');
                    p.setAttribute('hidden', '');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                const pane = document.getElementById(`${tab.dataset.tab}-pane`);
                if (pane) {
                    pane.classList.add('active');
                    pane.removeAttribute('hidden');
                }
                this.activeTab = tab.dataset.tab;
            });
        });
    }

    // Profile
    _wireProfileForm() {
        const form = document.getElementById('profile-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('profile-error');
            errorEl.textContent = '';

            const username = document.getElementById('settings-username').value.trim();
            const email = document.getElementById('settings-email').value.trim();
            const fullName = document.getElementById('settings-fullname').value.trim();
            const bio = document.getElementById('settings-bio').value.trim();

            // Client-side validation
            if (username.length < 3 || username.length > 30) {
                errorEl.textContent = 'Username must be 3–30 characters';
                return;
            }
            if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
                errorEl.textContent = 'Username can contain letters, numbers, dot, dash, underscore';
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errorEl.textContent = 'Please enter a valid email address';
                return;
            }
            if (!fullName) {
                errorEl.textContent = 'Full name is required';
                return;
            }
            if (bio.length > 500) {
                errorEl.textContent = 'Bio must be 500 characters or fewer';
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            const result = await this.userAPI.updateProfile({ username, email, fullName, bio });

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Changes';
            }

            if (!result.success) {
                errorEl.textContent = result.error || 'Failed to update profile';
                return;
            }

            // Update cached user — no full page reload needed.
            const updated = result.data?.user || result.data;
            if (updated) {
                this.user = { ...this.user, ...updated };
                window.authService?.setUser?.(this.user);
            }
            Toast.show?.('Profile updated', 'success');
        });
    }

    // Preferences
    _wirePreferencesForm() {
        const form = document.getElementById('preferences-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const theme = document.getElementById('settings-theme').value;
            const language = document.getElementById('settings-language').value;
            const emailNotifications = document.getElementById('settings-email-notifications').checked;
            const pushNotifications = document.getElementById('settings-push-notifications').checked;

            const prefs = {
                theme,
                language,
                notifications: {
                    email: emailNotifications,
                    push: pushNotifications
                }
            };

            // Apply theme immediately
            this._applyTheme(theme);
            localStorage.setItem('bravo_theme', theme);
            localStorage.setItem('bravo_language', language);

            // Persist to backend if the wrapper supports it.
            if (typeof this.userAPI.updatePreferences === 'function') {
                const result = await this.userAPI.updatePreferences(prefs);
                if (!result.success) {
                    // Soft-fail — preferences still saved locally.
                    Toast.show?.('Preferences saved locally (server sync failed)', 'warning');
                    return;
                }
                if (result.data?.user) {
                    this.user = { ...this.user, ...result.data.user };
                    window.authService?.setUser?.(this.user);
                }
            }

            Toast.show?.('Preferences saved', 'success');
        });
    }

    _applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        // Fire an event so other components can react.
        try {
            window.dispatchEvent(new CustomEvent('bravo:theme-change', { detail: { theme } }));
        } catch {}
    }

    // Security (password update)
    _wireSecurityForm() {
        const form = document.getElementById('security-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('security-error');
            errorEl.textContent = '';

            const currentPassword = document.getElementById('settings-current-pw').value;
            const newPassword = document.getElementById('settings-new-pw').value;
            const confirmPassword = document.getElementById('settings-confirm-pw').value;

            if (!currentPassword) {
                errorEl.textContent = 'Please enter your current password';
                return;
            }
            if (!newPassword) {
                errorEl.textContent = 'Please enter a new password';
                return;
            }
            if (newPassword !== confirmPassword) {
                errorEl.textContent = 'New passwords do not match';
                return;
            }

            const strengthError = this._validatePasswordStrength(newPassword);
            if (strengthError) {
                errorEl.textContent = strengthError;
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
            }

            // Route through authService for 401-refresh + consistent shape.
            const result = await window.authService.api._request('/auth/update-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Password';
            }

            if (!result.ok) {
                errorEl.textContent = result.data?.error || 'Failed to update password';
                return;
            }

            form.reset();
            Toast.show?.('Password updated. Other sessions may need to sign in again.', 'success');
        });
    }

    _validatePasswordStrength(pw) {
        if (pw.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter';
        if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter';
        if (!/[0-9]/.test(pw)) return 'Password must contain a number';
        if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain a special character';
        return null;
    }

    // Delete account
    _wireDeleteAccount() {
        const btn = document.getElementById('delete-account-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            // Show a modal that prompts for it.
            const handle = Modal.show({
                title: 'Delete Account',
                content: `
                    <div style="margin-bottom:16px;">
                        <p style="color:#ff4757; font-weight:bold;">This action is permanent.</p>
                        <p>All your data will be deleted. Type your password to confirm.</p>
                    </div>
                    <form id="delete-account-form">
                        <div class="form-group">
                            <label for="delete-account-pw">Password</label>
                            <input type="password" id="delete-account-pw" required autocomplete="current-password">
                        </div>
                        <div id="delete-account-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                    </form>
                `,
                buttons: [
                    { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                    { text: 'Delete Account', class: 'btn-danger', action: 'delete' }
                ]
            });

            requestAnimationFrame(() => {
                const deleteBtn = handle?.element?.querySelector('[data-action="delete"]');
                if (!deleteBtn) return;
                deleteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const pwInput = document.getElementById('delete-account-pw');
                    const errorEl = document.getElementById('delete-account-error');
                    const password = pwInput?.value || '';
                    if (!password) {
                        if (errorEl) errorEl.textContent = 'Password is required';
                        return;
                    }

                    deleteBtn.disabled = true;
                    deleteBtn.textContent = 'Deleting...';

                    const result = await this.userAPI.deleteAccount(password);

                    if (!result.success) {
                        if (errorEl) errorEl.textContent = result.error || 'Failed to delete account';
                        deleteBtn.disabled = false;
                        deleteBtn.textContent = 'Delete Account';
                        return;
                    }

                    handle?.close?.();
                    await window.authService?.logout?.();
                    Toast.show?.('Account deleted', 'success');
                    setTimeout(() => {
                        window.location.hash = 'home';
                        window.location.reload();
                    }, 1500);
                });
            });
        });
    }

    _wireResendVerification() {
        const btn = document.getElementById('resend-verification-btn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            if (!this.user?.email) {
                Toast.show?.('Email not found', 'error');
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Sending...';

            // Use authService's API wrapper if available; otherwise raw fetch.
            const result = await window.authService.api._request('/auth/resend-verification', {
                method: 'POST',
                body: JSON.stringify({ email: this.user.email })
            });

            btn.disabled = false;
            btn.textContent = 'Resend Verification Email';

            if (result.ok) {
                Toast.show?.('Verification email sent', 'success');
            } else {
                Toast.show?.(result.data?.error || 'Failed to send', 'error');
            }
        });
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.SettingsPage = SettingsPage;
