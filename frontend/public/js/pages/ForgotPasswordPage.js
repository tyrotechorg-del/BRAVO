/**
 * Forgot Password Page - Complete Working Version
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
                        <input type="email" id="reset-email" name="email" required placeholder="your@email.com" value="${this.escapeHtml(this.email)}">
                    </div>
                    ${this.error ? `<div class="error-message" style="color: #ff4757; margin-bottom: 16px; padding: 10px; background: rgba(255,71,87,0.1); border-radius: 8px;">${this.escapeHtml(this.error)}</div>` : ''}
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

    renderSuccess() {
        return `
            <div class="form-container animate-fade-in-up">
                <div class="success-icon" style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-envelope" style="font-size: 64px; color: var(--primary-color);"></i>
                </div>
                <h2 style="text-align: center;">Check Your Email</h2>
                <p style="text-align: center;">We've sent a password reset link to <strong>${this.escapeHtml(this.email)}</strong></p>
                <p style="text-align: center; color: #888;">The link will expire in 1 hour.</p>
                <div class="form-actions" style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('login')">Back to Login</button>
                    <button class="btn-outline" id="resend-link">Resend Email</button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        // Handle form submission
        const form = document.getElementById('forgot-password-form');
        if (form) {
            // Remove existing listener to prevent duplicates
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForgotPassword();
            });
        }

        // Handle resend button
        const resendBtn = document.getElementById('resend-link');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                await this.submitForgotPassword();
            });
        }
        
        // Focus on email input
        const emailInput = document.getElementById('reset-email');
        if (emailInput) {
            emailInput.focus();
        }
    }

    async submitForgotPassword() {
        const emailInput = document.getElementById('reset-email');
        if (!emailInput) return;

        const email = emailInput.value.trim();
        
        // Validate email
        if (!email) {
            this.error = 'Please enter your email address';
            this.isLoading = false;
            await this.rerender();
            return;
        }
        
        if (!this.isValidEmail(email)) {
            this.error = 'Please enter a valid email address';
            this.isLoading = false;
            await this.rerender();
            return;
        }

        this.email = email;
        this.isLoading = true;
        this.error = null;
        await this.rerender();

        try {
            // Use AuthAPI for the request
            const auth = new AuthAPI();
            const result = await auth.forgotPassword(email);
            
            if (result && result.success !== false) {
                this.isSubmitted = true;
                this.isLoading = false;
                await this.rerender();
                
                if (typeof Toast !== 'undefined') {
                    Toast.show('Reset link sent! Check your email.', 'success');
                }
            } else {
                this.error = result?.error || 'Failed to send reset link. Please try again.';
                this.isLoading = false;
                await this.rerender();
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            this.error = 'Network error. Please check your connection and try again.';
            this.isLoading = false;
            await this.rerender();
        }
    }
    
    async rerender() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = this.render();
            await this.afterRender();
        }
    }
    
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Make sure it's globally available
if (typeof window !== 'undefined') {
    window.ForgotPasswordPage = ForgotPasswordPage;
}