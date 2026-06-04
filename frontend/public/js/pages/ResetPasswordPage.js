/**
 * Reset Password Page - Clean Working Version
 */

class ResetPasswordPage {
    constructor(token = null) {
        console.log('🔐 ResetPasswordPage constructor, token:', token);
        this.token = token;
        this.password = '';
        this.confirmPassword = '';
        this.isLoading = false;
        this.isSuccess = false;
        this.error = null;
    }

    render() {
        console.log('🎨 Rendering ResetPasswordPage');
        
        if (this.isSuccess) {
            return this.renderSuccess();
        }

        return `
            <div class="form-container animate-fade-in-up">
                <h2>Reset Password</h2>
                <p class="form-description">Enter your new password below.</p>
                ${this.token ? `<p style="font-size: 11px; color: #666; text-align: center; word-break: break-all;">Token: ${this.token.substring(0, 30)}...</p>` : ''}
                <form id="reset-password-form">
                    <div class="form-group">
                        <label>New Password</label>
                        <input type="password" id="reset-password" required placeholder="Enter new password">
                        <small>Must be at least 6 characters with uppercase and number</small>
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <input type="password" id="reset-confirm-password" required placeholder="Confirm new password">
                    </div>
                    ${this.error ? `<div class="error-message" style="color: #ff4757; margin-bottom: 16px; padding: 10px; background: rgba(255,71,87,0.1); border-radius: 8px;">${this.escapeHtml(this.error)}</div>` : ''}
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

    renderSuccess() {
        return `
            <div class="form-container animate-fade-in-up">
                <div class="success-icon" style="text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-check-circle" style="font-size: 64px; color: #4caf50;"></i>
                </div>
                <h2 style="text-align: center;">Password Reset Successful!</h2>
                <p style="text-align: center;">Your password has been changed successfully.</p>
                <p style="text-align: center;">You can now login with your new password.</p>
                <div class="form-actions" style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('login')">Go to Login</button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        console.log('📄 afterRender called');
        
        const form = document.getElementById('reset-password-form');
        if (form) {
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitResetPassword();
            });
            console.log('✅ Form event listener attached');
        }
        
        const passwordInput = document.getElementById('reset-password');
        if (passwordInput) {
            passwordInput.focus();
        }
    }

    async submitResetPassword() {
        console.log('📤 Submitting reset password');
        
        const passwordInput = document.getElementById('reset-password');
        const confirmInput = document.getElementById('reset-confirm-password');

        if (!passwordInput || !confirmInput) {
            console.error('Inputs not found');
            return;
        }

        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (!password) {
            this.error = 'Please enter a new password';
            await this.rerender();
            return;
        }

        if (password.length < 6) {
            this.error = 'Password must be at least 6 characters';
            await this.rerender();
            return;
        }
        
        if (!/[A-Z]/.test(password)) {
            this.error = 'Password must contain at least one uppercase letter';
            await this.rerender();
            return;
        }
        
        if (!/[0-9]/.test(password)) {
            this.error = 'Password must contain at least one number';
            await this.rerender();
            return;
        }

        if (password !== confirmPassword) {
            this.error = 'Passwords do not match';
            await this.rerender();
            return;
        }

        this.isLoading = true;
        this.error = null;
        await this.rerender();

        try {
            const apiUrl = `${window.API_BASE_URL}/auth/reset-password/${this.token}`;
            console.log('API URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            const data = await response.json();
            console.log('Response:', response.status, data);
            
            if (response.ok) {
                this.isSuccess = true;
                this.isLoading = false;
                await this.rerender();
                Toast.show('Password reset successfully!', 'success');
            } else {
                this.error = data.error || 'Failed to reset password. Link may have expired.';
                this.isLoading = false;
                await this.rerender();
            }
        } catch (error) {
            console.error('Reset password error:', error);
            this.error = 'Network error. Please try again.';
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Single export
window.ResetPasswordPage = ResetPasswordPage;
console.log('✅ ResetPasswordPage loaded and registered');