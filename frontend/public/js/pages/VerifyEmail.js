/**
 * Email Verification Page
 */

class VerifyEmailPage {
    constructor(token = null) {
        this.token = token;
        this.isVerifying = false;
        this.isVerified = false;
        this.error = null;
    }

    async render() {
        if (!this.token && window.location.hash) {
            const hash = window.location.hash;
            const match = hash.match(/verify-email\/(.+)/);
            if (match) this.token = match[1];
        }

        if (this.token && !this.isVerifying && !this.isVerified) {
            await this.verifyEmail();
        }

        if (this.isVerified) {
            return this.renderSuccess();
        }

        if (this.error) {
            return this.renderError();
        }

        return this.renderVerifying();
    }

    renderVerifying() {
        return `
            <div class="verify-email-container">
                <div class="verify-card animate-scale-in">
                    <div class="verify-icon">
                        <i class="fas fa-envelope fa-4x"></i>
                    </div>
                    <h2>Verifying Your Email</h2>
                    <div class="spinner"></div>
                    <p>Please wait while we verify your email address...</p>
                </div>
            </div>
        `;
    }

    renderSuccess() {
        return `
            <div class="verify-email-container">
                <div class="verify-card success animate-scale-in">
                    <div class="verify-icon success">
                        <i class="fas fa-check-circle fa-4x"></i>
                    </div>
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

    renderError() {
        return `
            <div class="verify-email-container">
                <div class="verify-card error animate-scale-in">
                    <div class="verify-icon error">
                        <i class="fas fa-exclamation-circle fa-4x"></i>
                    </div>
                    <h2>Verification Failed</h2>
                    <p>${this.escapeHtml(this.error)}</p>
                    <div class="verify-buttons">
                        <button class="btn-primary" id="resend-verification">Resend Verification Email</button>
                        <button class="btn-outline" id="go-to-login">Back to Login</button>
                    </div>
                </div>
            </div>
        `;
    }

    async verifyEmail() {
        this.isVerifying = true;
        
        try {
            const authService = new AuthService();
            const result = await authService.verifyEmail(this.token);
            
            if (result.success) {
                this.isVerified = true;
                Toast.show('Email verified successfully! You can now login.', 'success');
            } else {
                this.error = result.error || 'Invalid or expired verification link';
            }
        } catch (error) {
            this.error = 'Failed to verify email. Please try again.';
        } finally {
            this.isVerifying = false;
        }
    }

    async resendVerification() {
        const email = prompt('Enter your email address to resend verification link:');
        if (!email) return;
        
        const authService = new AuthService();
        const result = await authService.resendVerification(email);
        
        if (result.success) {
            Toast.show('Verification email sent! Please check your inbox.', 'success');
        } else {
            Toast.show(result.error || 'Failed to send verification email', 'error');
        }
    }

    async afterRender() {
        const loginBtn = document.getElementById('go-to-login');
        const homeBtn = document.getElementById('go-to-home');
        const resendBtn = document.getElementById('resend-verification');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                window.location.hash = 'login';
            });
        }
        
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.hash = 'home';
            });
        }
        
        if (resendBtn) {
            resendBtn.addEventListener('click', () => {
                this.resendVerification();
            });
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.VerifyEmailPage = VerifyEmailPage;