/**
 * Reset Password Page
 *
 * ============================================================
 * FIXES FROM THE ORIGINAL
 * ============================================================
 *  - The original rendered the first 30 chars of the reset token
 *    in the page UI ("Token: abc123..."). That's a debug leftover
 *    that has no business in production — anyone with shoulder-
 *    surfing access to the user's screen could partially capture
 *    a high-value secret. Removed.
 *  - Client password policy was `>= 6 chars + uppercase + number`,
 *    but the backend requires `>= 8 chars + uppercase + number +
 *    special char`. Aligned to match.
 *  - Used AuthAPI directly; now uses window.authService.
 *  - No specific handling for 429 (passwordLimiter is 10/hr); now
 *    shown explicitly.
 *  - No specific handling for 400 / token expired or invalid;
 *    distinguished from generic errors so the user knows what to
 *    do next ("request a new reset link").
 */

class ResetPasswordPage {
    constructor(token = null) {
        this.token = this._extractToken(token);
        this.isLoading = false;
        this.isSuccess = false;
        this.error = null;
        this.tokenInvalid = false; // distinguishes "bad token" from generic errors
    }

    // FIX: Token extraction now happens in the constructor, not in
    // render(). The original VerifyEmail.js had the same pattern and
    // it caused subtle ordering issues — render() is supposed to be
    // pure. Side-effecting reads from window.location belong in
    // construction.
    _extractToken(passedToken) {
        if (passedToken) return passedToken;
        const hash = window.location.hash || '';
        const m = hash.match(/reset-password\/(.+)/);
        return m ? decodeURIComponent(m[1]) : null;
    }

    render() {
        if (this.isSuccess) return this._renderSuccess();
        if (!this.token || this.tokenInvalid) return this._renderInvalidToken();

        return `
            <div class="form-container animate-fade-in-up">
                <h2>Reset Password</h2>
                <p class="form-description">Enter your new password below.</p>
                <form id="reset-password-form" novalidate>
                    <div class="form-group">
                        <label for="reset-password">New Password</label>
                        <input type="password" id="reset-password" name="password" required
                            minlength="8"
                            autocomplete="new-password"
                            placeholder="Enter new password">
                        <small>At least 8 characters with uppercase, number, and special character.</small>
                    </div>
                    <div class="form-group">
                        <label for="reset-confirm-password">Confirm Password</label>
                        <input type="password" id="reset-confirm-password" name="confirmPassword" required
                            minlength="8"
                            autocomplete="new-password"
                            placeholder="Confirm new password">
                    </div>
                    ${this.error ? `
                        <div class="error-message" role="alert" style="color: #ff4757; margin-bottom: 16px; padding: 10px; background: rgba(255,71,87,0.1); border-radius: 8px;">
                            ${this._escapeHtml(this.error)}
                        </div>
                    ` : ''}
                    <button type="submit" class="btn-primary" ${this.isLoading ? 'disabled' : ''} style="width: 100%; padding: 12px;">
                        ${this.isLoading ? '<i class="fas fa-spinner fa-spin"></i> Resetting...' : 'Reset Password'}
                    </button>
                </form>
                <p class="form-footer" style="margin-top: 20px; text-align: center;">
                    <a onclick="window.bravoApp.navigateTo('login')" style="cursor: pointer; color: var(--primary-color);">← Back to Login</a>
                </p>
            </div>
        `;
    }

    _renderSuccess() {
        return `
            <div class="form-container animate-fade-in-up">
                <div class="success-icon" style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-check-circle" style="font-size: 64px; color: #4caf50;"></i>
                </div>
                <h2 style="text-align: center;">Password Reset Successful!</h2>
                <p style="text-align: center;">You can now login with your new password.</p>
                <div class="form-actions" style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
                    <button class="btn-primary" id="goto-login-btn">Go to Login</button>
                </div>
            </div>
        `;
    }

    _renderInvalidToken() {
        return `
            <div class="form-container animate-fade-in-up">
                <div class="error-icon" style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #ff9800;"></i>
                </div>
                <h2 style="text-align: center;">Invalid or Expired Link</h2>
                <p style="text-align: center;">
                    This password reset link is invalid or has expired. Reset links are valid for 1 hour.
                </p>
                <div class="form-actions" style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
                    <button class="btn-primary" id="goto-forgot-btn">Request a New Link</button>
                    <button class="btn-outline" id="goto-login-btn">Back to Login</button>
                </div>
            </div>
        `;
    }

    afterRender() {
        const form = document.getElementById('reset-password-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this._submit();
            });
        }

        const gotoLogin = document.getElementById('goto-login-btn');
        if (gotoLogin) gotoLogin.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            else window.location.hash = 'login';
        });

        const gotoForgot = document.getElementById('goto-forgot-btn');
        if (gotoForgot) gotoForgot.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('forgot-password');
            else window.location.hash = 'forgot-password';
        });

        const passwordInput = document.getElementById('reset-password');
        if (passwordInput && !this.isSuccess && !this.tokenInvalid) passwordInput.focus();
    }

    async _submit() {
        if (this.isLoading) return;

        const password = document.getElementById('reset-password')?.value || '';
        const confirmPassword = document.getElementById('reset-confirm-password')?.value || '';

        const validationError = this._validate(password, confirmPassword);
        if (validationError) {
            this.error = validationError;
            this._rerender();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this._rerender();

        const result = await window.authService.resetPassword(this.token, password);

        this.isLoading = false;

        if (result.success) {
            this.isSuccess = true;
            this._rerender();
            Toast.show('Password reset successfully', 'success');
            return;
        }

        if (result.status === 429) {
            this.error = 'Too many attempts. Please wait and try again.';
        } else if (result.status === 400 || (result.error && result.error.toLowerCase().includes('token'))) {
            // Token invalid or expired — surface the dedicated screen.
            this.tokenInvalid = true;
            this._rerender();
            return;
        } else {
            this.error = result.error || 'Failed to reset password. Please try again.';
        }
        this._rerender();
    }

    _validate(password, confirmPassword) {
        if (!password || !confirmPassword) return 'Please fill in both password fields';
        if (password !== confirmPassword) return 'Passwords do not match';
        if (password.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
        if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
        if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character';
        return null;
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

window.ResetPasswordPage = ResetPasswordPage;