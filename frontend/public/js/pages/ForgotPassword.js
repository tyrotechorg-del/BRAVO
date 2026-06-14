/**
 * Forgot Password Page
 *
 * ============================================================
 * FIXES FROM THE ORIGINAL
 * ============================================================
 *  - Used AuthAPI directly. Now uses window.authService.
 *  - Backend has a passwordLimiter (10/hour from batch 5). A 429
 *    response wasn't handled gracefully — user just saw a generic
 *    "Failed to send reset link" message. Now shows the rate-limit
 *    explicitly.
 *  - The original used `cloneNode + replaceChild` to "prevent
 *    duplicate listeners". That hack indicates the rerender flow was
 *    fragile. We rebuild the whole #main-content innerHTML on each
 *    rerender, so the listeners die with the old DOM naturally — no
 *    duplicates possible.
 *  - We always show the success screen after a submit, even if the
 *    server returned an error, to avoid leaking which emails exist
 *    in the database (user-enumeration). The new AuthAPI.forgotPassword
 *    always returns `success: true` for non-429 responses, so the page
 *    code is now straightforward.
 */

class ForgotPasswordPage {
    constructor() {
        this.email = '';
        this.isSubmitted = false;
        this.isLoading = false;
        this.error = null;
    }

    render() {
        if (this.isSubmitted) return this._renderSuccess();

        return `
            <div class="form-container animate-fade-in-up">
                <h2>Forgot Password</h2>
                <p class="form-description">Enter your email address and we'll send you a link to reset your password.</p>
                <form id="forgot-password-form" novalidate>
                    <div class="form-group">
                        <label for="reset-email">Email Address</label>
                        <input type="email" id="reset-email" name="email" required
                            autocomplete="email"
                            placeholder="your@email.com"
                            value="${this._escapeAttr(this.email)}">
                    </div>
                    ${this.error ? `
                        <div class="error-message" role="alert" style="color: #ff4757; margin-bottom: 16px; padding: 10px; background: rgba(255,71,87,0.1); border-radius: 8px;">
                            ${this._escapeHtml(this.error)}
                        </div>
                    ` : ''}
                    <button type="submit" class="btn-primary" ${this.isLoading ? 'disabled' : ''} style="width: 100%; padding: 12px;">
                        ${this.isLoading ? '<i class="fas fa-spinner fa-spin"></i> Sending...' : 'Send Reset Link'}
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
                    <i class="fas fa-envelope" style="font-size: 64px; color: var(--primary-color);"></i>
                </div>
                <h2 style="text-align: center;">Check Your Email</h2>
                <p style="text-align: center;">
                    If an account exists for <strong>${this._escapeHtml(this.email)}</strong>,
                    a password reset link has been sent.
                </p>
                <p style="text-align: center; color: #888;">The link will expire in 1 hour.</p>
                <div class="form-actions" style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
                    <button class="btn-primary" id="goto-login-btn">Back to Login</button>
                    <button class="btn-outline" id="resend-btn" ${this.isLoading ? 'disabled' : ''}>
                        ${this.isLoading ? 'Sending...' : 'Resend Email'}
                    </button>
                </div>
            </div>
        `;
    }

    afterRender() {
        const form = document.getElementById('forgot-password-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this._submit();
            });
        }

        const resendBtn = document.getElementById('resend-btn');
        if (resendBtn) resendBtn.addEventListener('click', () => this._submit());

        const gotoLogin = document.getElementById('goto-login-btn');
        if (gotoLogin) gotoLogin.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            else window.location.hash = 'login';
        });

        const emailInput = document.getElementById('reset-email');
        if (emailInput && !this.isSubmitted) emailInput.focus();
    }

    async _submit() {
        if (this.isLoading) return;

        const emailInput = document.getElementById('reset-email');
        const email = (emailInput ? emailInput.value : this.email).trim();

        if (!email) {
            this.error = 'Please enter your email address';
            this._rerender();
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.error = 'Please enter a valid email address';
            this._rerender();
            return;
        }

        this.email = email;
        this.isLoading = true;
        this.error = null;
        this._rerender();

        const result = await window.authService.forgotPassword(email);

        this.isLoading = false;

        if (result.success) {
            this.isSubmitted = true;
            this._rerender();
            Toast.show('If your account exists, a reset link has been sent.', 'success');
            return;
        }

        // The only failure path AuthAPI surfaces for forgotPassword is 429.
        // Any other server error still resolves as success: true (to avoid
        // user enumeration). See api/auth.js for the policy.
        this.error = result.error || 'Something went wrong. Please try again.';
        this._rerender();
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
    _escapeAttr(text) { return this._escapeHtml(text); }
}

window.ForgotPasswordPage = ForgotPasswordPage;