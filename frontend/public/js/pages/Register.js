/**
 * Register Page - Artists need email verification, Listeners don't
 */

class RegisterPage {
    render() {
        return `
            <div class="form-container animate-fade-in-up">
                <h2>Create Account</h2>
                <form id="register-form">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="reg-username" required placeholder="choose a username">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="reg-email" required placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="reg-fullname" required placeholder="enter your full name">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="reg-password" required placeholder="create a password">
                        <small>Must be at least 6 characters with uppercase and number</small>
                    </div>
                    <div class="form-group">
                        <label>Account Type</label>
                        <select id="reg-role">
                            <option value="listener">Listener - Enjoy Music (No verification needed)</option>
                            <option value="artist">Artist - Upload & Earn (Email verification required)</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary">Create Account</button>
                </form>
                <p class="form-footer">Already have an account? <a onclick="window.bravoApp.navigateTo('login')">Login</a></p>
            </div>
        `;
    }

    afterRender() {
        const form = document.getElementById('register-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('reg-username').value;
                const email = document.getElementById('reg-email').value;
                const fullName = document.getElementById('reg-fullname').value;
                const password = document.getElementById('reg-password').value;
                const role = document.getElementById('reg-role').value;
                
                if (!username || !email || !fullName || !password) {
                    Toast.show('Please fill in all fields', 'warning');
                    return;
                }
                
                if (password.length < 6) {
                    Toast.show('Password must be at least 6 characters', 'warning');
                    return;
                }
                
                if (!/[A-Z]/.test(password)) {
                    Toast.show('Password must contain at least one uppercase letter', 'warning');
                    return;
                }
                
                if (!/[0-9]/.test(password)) {
                    Toast.show('Password must contain at least one number', 'warning');
                    return;
                }
                
                Toast.show('Creating account...', 'info');
                
                const auth = new AuthAPI();
                const result = await auth.register({ username, email, fullName, password, role });
                
                if (result.success) {
                    if (role === 'artist') {
                        Toast.show('Registration successful! Please check your email to verify your account.', 'success');
                        // Show verification info modal
                        if (typeof Modal !== 'undefined') {
                            Modal.show({
                                title: 'Verification Required',
                                content: `
                                    <div class="verification-info">
                                        <i class="fas fa-envelope" style="font-size: 48px; color: var(--primary-color); margin-bottom: 16px;"></i>
                                        <h3>Verify Your Email Address</h3>
                                        <p>We've sent a verification link to <strong>${email}</strong></p>
                                        <p>Please check your inbox and click the verification link to start uploading music.</p>
                                        <hr>
                                        <p><small>Didn't receive the email? Check your spam folder or <a id="resend-link" style="color: var(--primary-color); cursor: pointer;">click here to resend</a></small></p>
                                    </div>
                                `,
                                buttons: [
                                    { text: 'Go to Login', class: 'btn-primary', action: 'login', onClick: () => {
                                        window.location.hash = 'login';
                                    }}
                                ]
                            });
                        } else {
                            setTimeout(() => {
                                window.location.hash = 'login';
                            }, 3000);
                        }
                        
                        setTimeout(() => {
                            const resendLink = document.getElementById('resend-link');
                            if (resendLink) {
                                resendLink.addEventListener('click', async () => {
                                    const authService = new AuthService();
                                    const resendResult = await authService.resendVerification(email);
                                    if (resendResult.success) {
                                        Toast.show('Verification email resent! Check your inbox.', 'success');
                                    } else {
                                        Toast.show(resendResult.error || 'Failed to resend', 'error');
                                    }
                                });
                            }
                        }, 100);
                    } else {
                        Toast.show('Registration successful! Welcome to Bravo Music! 🎉', 'success');
                        window.location.reload();
                    }
                } else {
                    Toast.show(result.error || 'Registration failed', 'error');
                }
            });
        }
    }
}

window.RegisterPage = RegisterPage;