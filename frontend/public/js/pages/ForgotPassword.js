/**
 * Forgot Password Page
 */

class ForgotPasswordPage {
    constructor() {
        this.email = '';
        this.isSubmitted = false;
        this.isLoading = false;
        this.error = null;
    }

    render() {
        if (this.isSubmitted) {
            return this.renderSuccess();
        }

        return `
            <div class="form-container animate-fade-in-up">
                <h2>Forgot Password</h2>
                <p class="form-description">Enter your email address and we'll send you a link to reset your password.</p>
                <form id="forgot-password-form">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="reset-email" required placeholder="your@email.com" value="${this.escapeHtml(this.email)}">
                    </div>
                    ${this.error ? `<div class="error-message">${this.escapeHtml(this.error)}</div>` : ''}
                    <button type="submit" class="btn-primary" ${this.isLoading ? 'disabled' : ''}>
                        ${this.isLoading ? '<i class="fas fa-spinner fa-spin"></i> Sending...' : 'Send Reset Link'}
                    </button>
                </form>
                <p class="form-footer">
                    <a onclick="window.bravoApp.navigateTo('login')">Back to Login</a>
                </p>
            </div>
        `;
    }

    renderSuccess() {
        return `
            <div class="form-container animate-fade-in-up">
                <div class="success-icon">
                    <i class="fas fa-envelope"></i>
                </div>
                <h2>Check Your Email</h2>
                <p>We've sent a password reset link to <strong>${this.escapeHtml(this.email)}</strong></p>
                <p>The link will expire in 1 hour.</p>
                <div class="form-actions">
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('login')">Back to Login</button>
                    <button class="btn-outline" id="resend-link">Resend Email</button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        const form = document.getElementById('forgot-password-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForgotPassword();
            });
        }

        const resendBtn = document.getElementById('resend-link');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                await this.submitForgotPassword();
            });
        }
    }

    async submitForgotPassword() {
        const emailInput = document.getElementById('reset-email');
        if (!emailInput) return;

        const email = emailInput.value.trim();
        
        if (!email) {
            this.error = 'Please enter your email address';
            this.render();
            this.afterRender();
            return;
        }

        this.email = email;
        this.isLoading = true;
        this.error = null;
        this.render();
        this.afterRender();

        try {
            const authService = new AuthService();
            const result = await authService.forgotPassword(email);
            
            if (result.success) {
                this.isSubmitted = true;
                this.render();
                this.afterRender();
                Toast.show('Reset link sent! Check your email.', 'success');
            } else {
                this.error = result.error || 'Failed to send reset link. Please try again.';
                this.isLoading = false;
                this.render();
                this.afterRender();
            }
        } catch (error) {
            this.error = 'Network error. Please try again.';
            this.isLoading = false;
            this.render();
            this.afterRender();
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.ForgotPasswordPage = ForgotPasswordPage;