

class VerifyEmailPage {
    constructor(token = null) {
        this.token = this._extractToken(token);
        this.isVerifying = false;
        this.isVerified = false;
        this.error = null;
        this.showResendForm = false;
        this.resendStatus = null; // 'pending' | 'sent' | 'error'
        this.resendError = null;
        this._hasStartedVerification = false;
    }

    _extractToken(passedToken) {
        if (passedToken) return passedToken;
        const hash = window.location.hash || '';
        const m = hash.match(/verify-email\/(.+)/);
        return m ? decodeURIComponent(m[1]) : null;
    }

    render() {
        if (this.isVerified) return this._renderSuccess();
        if (this.error) return this._renderError();
        if (!this.token) return this._renderNoToken();
        return this._renderVerifying();
    }

    _renderVerifying() {
        return `
            <div class="verify-email-container">
                <div class="verify-card animate-scale-in">
                    <div class="verify-icon"><i class="fas fa-envelope fa-4x"></i></div>
                    <h2>Verifying Your Email</h2>
                    <div class="spinner"></div>
                    <p>Please wait while we verify your email address...</p>
                </div>
            </div>
        `;
    }

    _renderSuccess() {
        return `
            <div class="verify-email-container">
                <div class="verify-card success animate-scale-in">
                    <div class="verify-icon success"><i class="fas fa-check-circle fa-4x"></i></div>
                    <h2>Email Verified Successfully!</h2>
                    <p>Your email has been confirmed. You can now enjoy all features of Bravo Music.</p>
                    <div class="verify-buttons">
                        <button class="btn-primary" id="go-to-login">Login Now</button>
                        <button class="btn-outline" id="go-to-home">Go to Home</button>
                    </div>
                </div>
            </div>
        `;
    }

    _renderError() {
        const showResendBlock = this.showResendForm
            ? `
                <form id="resend-verification-form" style="margin-top: 16px; text-align: left;">
                    <div class="form-group">
                        <label for="resend-email">Email Address</label>
                        <input type="email" id="resend-email" required autocomplete="email"
                            placeholder="your@email.com" style="width: 100%;">
                    </div>
                    ${this.resendError ? `
                        <div class="error-message" style="color: #ff4757; margin-bottom: 12px; padding: 8px; background: rgba(255,71,87,0.1); border-radius: 6px;">
                            ${this._escapeHtml(this.resendError)}
                        </div>
                    ` : ''}
                    ${this.resendStatus === 'sent' ? `
                        <div style="color: #4caf50; margin-bottom: 12px; padding: 8px; background: rgba(76,175,80,0.1); border-radius: 6px;">
                            ✓ If your account needs verification, a new email has been sent.
                        </div>
                    ` : ''}
                    <button type="submit" class="btn-primary" ${this.resendStatus === 'pending' ? 'disabled' : ''} style="width: 100%;">
                        ${this.resendStatus === 'pending' ? '<i class="fas fa-spinner fa-spin"></i> Sending...' : 'Send Verification Email'}
                    </button>
                </form>
            `
            : `
                <div class="verify-buttons">
                    <button class="btn-primary" id="open-resend-form">Resend Verification Email</button>
                    <button class="btn-outline" id="go-to-login">Back to Login</button>
                </div>
            `;

        return `
            <div class="verify-email-container">
                <div class="verify-card error animate-scale-in">
                    <div class="verify-icon error"><i class="fas fa-exclamation-circle fa-4x"></i></div>
                    <h2>Verification Failed</h2>
                    <p>${this._escapeHtml(this.error)}</p>
                    ${showResendBlock}
                </div>
            </div>
        `;
    }

    _renderNoToken() {
        return `
            <div class="verify-email-container">
                <div class="verify-card animate-scale-in">
                    <div class="verify-icon"><i class="fas fa-link fa-4x"></i></div>
                    <h2>No Verification Link Found</h2>
                    <p>Open the verification link from your email to verify your account, or request a new one below.</p>
                    <div class="verify-buttons">
                        <button class="btn-primary" id="open-resend-form">Request New Verification Email</button>
                        <button class="btn-outline" id="go-to-login">Back to Login</button>
                    </div>
                </div>
            </div>
        `;
    }

    afterRender() {
        // Wire up the static buttons that may appear in any state.
        const loginBtn = document.getElementById('go-to-login');
        if (loginBtn) loginBtn.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            else window.location.hash = 'login';
        });

        const homeBtn = document.getElementById('go-to-home');
        if (homeBtn) homeBtn.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('home');
            else window.location.hash = 'home';
        });

        const openResend = document.getElementById('open-resend-form');
        if (openResend) openResend.addEventListener('click', () => {
            this.showResendForm = true;
            this.resendStatus = null;
            this.resendError = null;
            this._rerender();
        });

        const resendForm = document.getElementById('resend-verification-form');
        if (resendForm) {
            resendForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this._submitResend();
            });
        }

        // Kick off the verification exactly once on first mount.
        if (this.token && !this._hasStartedVerification && !this.isVerified && !this.error) {
            this._hasStartedVerification = true;
            this._verifyEmail();
        }
    }

    async _verifyEmail() {
        this.isVerifying = true;
        // No need to rerender — we're already showing the verifying view.

        const result = await window.authService.verifyEmail(this.token);

        this.isVerifying = false;
        if (result.success) {
            this.isVerified = true;
            Toast.show('Email verified! You can now login.', 'success');
        } else {
            this.error = result.error || 'Invalid or expired verification link.';
        }
        this._rerender();
    }

    async _submitResend() {
        const input = document.getElementById('resend-email');
        const email = (input ? input.value : '').trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.resendError = 'Please enter a valid email address';
            this._rerender();
            return;
        }

        this.resendStatus = 'pending';
        this.resendError = null;
        this._rerender();

        const result = await window.authService.resendVerification(email);

        if (result.success) {
            this.resendStatus = 'sent';
        } else {
            this.resendStatus = 'error';
            this.resendError = result.status === 429
                ? 'Too many requests. Please wait and try again.'
                : (result.error || 'Failed to send verification email');
        }
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
}

window.VerifyEmailPage = VerifyEmailPage;
