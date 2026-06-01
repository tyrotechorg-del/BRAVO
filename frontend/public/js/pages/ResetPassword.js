/**
 * Reset Password Page
 */

class ResetPasswordPage {
    constructor(token = null) {
        this.token = token;
        this.password = '';
        this.confirmPassword = '';
        this.isLoading = false;
        this.isResetting = false;
        this.isSuccess = false;
        this.error = null;
    }

    render() {
        if (this.isSuccess) {
            return this.renderSuccess();
        }

        return `
            <div class="form-container animate-fade-in-up">
                <h2>Reset Password</h2>
                <p class="form-description">Enter your new password below.</p>
                <form id="reset-password-form">
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" id="reset-password" required placeholder="Enter new password">
                        <small>Must be at least 6 characters</small>
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <input type="password" id="reset-confirm-password" required placeholder="Confirm new password">
                    </div>
                    ${this.error ? `<div class="error-message">${this.escapeHtml(this.error)}</div>` : ''}
                    <button type="submit" class="btn-primary" ${this.isLoading ? 'disabled' : ''}>
                        ${this.isLoading ? '<i class="fas fa-spinner fa-spin"></i> Resetting...' : 'Reset Password'}
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
                    <i class="fas fa-check-circle"></i>
                </div>
                <h2>Password Reset Successful!</h2>
                <p>Your password has been changed successfully.</p>
                <p>You can now login with your new password.</p>
                <div class="form-actions">
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('login')">Go to Login</button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        const form = document.getElementById('reset-password-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitResetPassword();
            });
        }
    }

    async submitResetPassword() {
        const passwordInput = document.getElementById('reset-password');
        const confirmInput = document.getElementById('reset-confirm-password');

        if (!passwordInput || !confirmInput) return;

        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (!password) {
            this.error = 'Please enter a new password';
            this.render();
            this.afterRender();
            return;
        }

        if (password.length < 6) {
            this.error = 'Password must be at least 6 characters';
            this.render();
            this.afterRender();
            return;
        }

        if (password !== confirmPassword) {
            this.error = 'Passwords do not match';
            this.render();
            this.afterRender();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.render();
        this.afterRender();

        try {
            const authService = new AuthService();
            const result = await authService.resetPassword(this.token, password);
            
            if (result.success) {
                this.isSuccess = true;
                this.render();
                this.afterRender();
                Toast.show('Password reset successfully!', 'success');
            } else {
                this.error = result.error || 'Failed to reset password. Link may have expired.';
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

window.ResetPasswordPage = ResetPasswordPage;