

class RegisterPage {
    constructor() {
        this.isSubmitting = false;
        this.error = null;
        this.formValues = { username: '', email: '', fullName: '', password: '', role: 'listener' };
    }

    render() {
        const v = this.formValues;
        return `
            <div class="form-container animate-fade-in-up">
                <h2>Create Account</h2>
                <form id="register-form" novalidate>
                    <div class="form-group">
                        <label for="reg-username">Username</label>
                        <input type="text" id="reg-username" name="username" required
                            value="${this._escapeAttr(v.username)}"
                            minlength="3" maxlength="30"
                            autocomplete="username"
                            pattern="[a-zA-Z0-9_.-]+"
                            placeholder="choose a username">
                        <small>3-30 characters. Letters, numbers, dots, underscores, hyphens.</small>
                    </div>
                    <div class="form-group">
                        <label for="reg-email">Email</label>
                        <input type="email" id="reg-email" name="email" required
                            value="${this._escapeAttr(v.email)}"
                            autocomplete="email"
                            placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label for="reg-fullname">Full Name</label>
                        <input type="text" id="reg-fullname" name="fullName" required
                            value="${this._escapeAttr(v.fullName)}"
                            maxlength="100"
                            autocomplete="name"
                            placeholder="enter your full name">
                    </div>
                    <div class="form-group">
                        <label for="reg-password">Password</label>
                        <input type="password" id="reg-password" name="password" required
                            minlength="8"
                            autocomplete="new-password"
                            placeholder="create a password">
                        <small>At least 8 characters with uppercase, number, and special character.</small>
                    </div>
                    <div class="form-group">
                        <label for="reg-role">Account Type</label>
                        <select id="reg-role" name="role">
                            <option value="listener" ${v.role === 'listener' ? 'selected' : ''}>Listener — Enjoy music (no verification needed)</option>
                            <option value="artist" ${v.role === 'artist' ? 'selected' : ''}>Artist — Upload & earn (email verification required)</option>
                        </select>
                    </div>
                    ${this.error ? `
                        <div class="error-message" role="alert" style="color: #ff4757; margin-bottom: 16px; padding: 10px; background: rgba(255,71,87,0.1); border-radius: 8px;">
                            ${this._escapeHtml(this.error)}
                        </div>
                    ` : ''}
                    <button type="submit" class="btn-primary" id="register-submit" ${this.isSubmitting ? 'disabled' : ''} style="width: 100%;">
                        ${this.isSubmitting ? '<i class="fas fa-spinner fa-spin"></i> Creating account...' : 'Create Account'}
                    </button>
                </form>
                <p class="form-footer">
                    Already have an account?
                    <a onclick="window.bravoApp.navigateTo('login')" style="cursor: pointer;">Login</a>
                </p>
            </div>
        `;
    }

    afterRender() {
        const form = document.getElementById('register-form');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._submit();
        });
    }

    async _submit() {
        if (this.isSubmitting) return;

        const values = this._readForm();
        this.formValues = values;

        const validationError = this._validate(values);
        if (validationError) {
            this.error = validationError;
            this._rerender();
            return;
        }

        this.isSubmitting = true;
        this.error = null;
        this._rerender();

        const result = await window.authService.register(values);

        if (result.success) {
            if (values.role === 'artist') {
                Toast.show('Account created! Please verify your email to start uploading.', 'success');
                this._showVerificationInfoModal(values.email);
            } else {
                Toast.show('Welcome to Bravo Music!', 'success');
                window.location.reload();
            }
            return;
        }

        // Failure
        this.isSubmitting = false;
        if (result.status === 429) {
            this.error = 'Too many registration attempts from this network. Please wait and try again.';
        } else {
            this.error = result.error || 'Registration failed. Please try again.';
        }
        this._rerender();
    }

    _readForm() {
        return {
            username: document.getElementById('reg-username').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            fullName: document.getElementById('reg-fullname').value.trim(),
            password: document.getElementById('reg-password').value,
            role: document.getElementById('reg-role').value
        };
    }

    _validate(v) {
        if (!v.username || !v.email || !v.fullName || !v.password) {
            return 'Please fill in all fields';
        }

        if (v.username.length < 3 || v.username.length > 30) {
            return 'Username must be 3-30 characters';
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(v.username)) {
            return 'Username can only contain letters, numbers, dots, underscores, and hyphens';
        }

        // Server requires: length>=8, uppercase, number, special.
        if (v.password.length < 8) {
            return 'Password must be at least 8 characters';
        }
        if (!/[A-Z]/.test(v.password)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[0-9]/.test(v.password)) {
            return 'Password must contain at least one number';
        }
        if (!/[^A-Za-z0-9]/.test(v.password)) {
            return 'Password must contain at least one special character (e.g., !@#$%)';
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
            return 'Please enter a valid email address';
        }

        if (!['listener', 'artist'].includes(v.role)) {
            return 'Please choose a valid account type';
        }

        return null;
    }

    _showVerificationInfoModal(email) {
        if (typeof Modal === 'undefined') {
            setTimeout(() => { window.location.hash = 'login'; }, 3000);
            return;
        }

        const safeEmail = this._escapeHtml(email);
        Modal.show({
            title: 'Verification Required',
            content: `
                <div class="verification-info" style="text-align: center;">
                    <i class="fas fa-envelope" style="font-size: 48px; color: var(--primary-color); margin-bottom: 16px;"></i>
                    <h3>Verify Your Email Address</h3>
                    <p>We've sent a verification link to <strong>${safeEmail}</strong></p>
                    <p>Please check your inbox (and spam folder) and click the link to start uploading music.</p>
                    <p style="margin-top: 16px;">
                        Didn't receive it?
                        <a id="resend-link" style="color: var(--primary-color); cursor: pointer; text-decoration: underline;">
                            Resend
                        </a>
                    </p>
                    <div id="resend-status" style="margin-top: 8px; font-size: 14px;"></div>
                    <button id="goto-login" class="btn-primary" style="margin-top: 16px;">Go to Login</button>
                </div>
            `,
            buttons: []
        });

        requestAnimationFrame(() => {
            const gotoLogin = document.getElementById('goto-login');
            if (gotoLogin) {
                gotoLogin.addEventListener('click', () => {
                    if (window.bravoApp?.navigateTo) {
                        window.bravoApp.navigateTo('login');
                    } else {
                        window.location.hash = 'login';
                    }
                });
            }

            const resendLink = document.getElementById('resend-link');
            if (resendLink) {
                resendLink.addEventListener('click', async () => {
                    const status = document.getElementById('resend-status');
                    if (status) status.textContent = 'Sending...';
                    const result = await window.authService.resendVerification(email);
                    if (status) {
                        status.textContent = result.success
                            ? '✓ Sent! Check your inbox.'
                            : (result.error || 'Failed to resend');
                    }
                });
            }
        });
    }

    _rerender() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.render();
            this.afterRender();
        }
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // For HTML attribute interpolation: same as escapeHtml plus
    // handling of quotes (which textContent already covers via the
    // browser, but be explicit).
    _escapeAttr(text) {
        return this._escapeHtml(text);
    }
}

window.RegisterPage = RegisterPage;
