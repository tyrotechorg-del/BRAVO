

class LoginPage {
    constructor() {
        this.isSubmitting = false;
        this.error = null;
    }

    render() {
        return `
            <div class="form-container animate-fade-in-up">
                <h2>Login to Bravo Music</h2>
                <form id="login-form" novalidate>
                    <div class="form-group">
                        <label for="login-email">Email</label>
                        <input type="email" id="login-email" name="email" required autocomplete="email" placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label for="login-password">Password</label>
                        <input type="password" id="login-password" name="password" required autocomplete="current-password" placeholder="••••••••">
                    </div>
                    ${this.error ? `
                        <div class="error-message" role="alert" style="color: #ff4757; margin-bottom: 16px; padding: 10px; background: rgba(255,71,87,0.1); border-radius: 8px;">
                            ${this._escapeHtml(this.error)}
                        </div>
                    ` : ''}
                    <button type="submit" class="btn-primary" id="login-submit" ${this.isSubmitting ? 'disabled' : ''} style="width: 100%;">
                        ${this.isSubmitting ? '<i class="fas fa-spinner fa-spin"></i> Logging in...' : 'Login'}
                    </button>
                </form>
                <p class="form-footer">
                    <a onclick="window.bravoApp.navigateTo('forgot-password')" style="cursor: pointer;">Forgot Password?</a>
                </p>
                <p class="form-footer">
                    Don't have an account?
                    <a onclick="window.bravoApp.navigateTo('register')" style="cursor: pointer;">Register</a>
                </p>
            </div>
        `;
    }

    afterRender() {
        const form = document.getElementById('login-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._submit();
        });
    }

    async _submit() {
        if (this.isSubmitting) return; // double-submit guard

        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            this.error = 'Please enter both email and password';
            this._rerender();
            return;
        }

        this.isSubmitting = true;
        this.error = null;
        this._rerender();

        const result = await window.authService.login({ email, password });

        if (result.success) {
            const user = result.data?.user || window.authService.getUser();

            // Artists need verification before they can use artist features.
            if (user && user.role === 'artist' && !user.isVerified) {
                this.isSubmitting = false;
                this._rerender();
                Toast.show('Please verify your email first. Check your inbox!', 'warning');
                this._showResendVerificationModal(email);
                return;
            }

            Toast.show('Welcome back!', 'success');
            // Reload to bootstrap the full app state. (TODO: router-level
            window.location.reload();
            return;
        }

        // Failure path: handle specific status codes.
        this.isSubmitting = false;

        if (result.status === 429) {
            this.error = 'Too many login attempts. Please wait 15 minutes and try again.';
        } else if (result.error && result.error.toLowerCase().includes('verify')) {
            // Server says "please verify email" — show the resend modal.
            this._rerender();
            this._showResendVerificationModal(email);
            return;
        } else {
            this.error = result.error || 'Login failed. Please check your credentials.';
        }
        this._rerender();
    }

    _showResendVerificationModal(email) {
        if (typeof Modal === 'undefined') {
            Toast.show('Check your email for the verification link', 'info');
            return;
        }

        const safeEmail = this._escapeHtml(email);
        Modal.show({
            title: 'Email Not Verified',
            content: `
                <p>Your account exists, but your email hasn't been verified yet.</p>
                <p>We sent a verification link to <strong>${safeEmail}</strong> when you registered.</p>
                <p>Didn't get it? Resend below:</p>
                <button id="resend-verify-btn" class="btn-primary" style="margin-top: 12px;">
                    Resend Verification Email
                </button>
                <div id="resend-status" style="margin-top: 12px; font-size: 14px;"></div>
            `,
            buttons: [{ text: 'Close', class: 'btn-secondary', action: 'close' }]
        });

        // Wire up the resend button after the modal is in the DOM.
        // Using requestAnimationFrame is more reliable than setTimeout
        // for "DOM is now mounted" timing.
        requestAnimationFrame(() => {
            const btn = document.getElementById('resend-verify-btn');
            if (!btn) return;
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                const result = await window.authService.resendVerification(email);
                const status = document.getElementById('resend-status');
                if (result.success) {
                    if (status) status.textContent = 'Sent! Check your inbox.';
                    btn.innerHTML = '<i class="fas fa-check"></i> Sent';
                } else {
                    if (status) status.textContent = result.error || 'Failed to send';
                    btn.disabled = false;
                    btn.textContent = 'Try Again';
                }
            });
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
}

window.LoginPage = LoginPage;
