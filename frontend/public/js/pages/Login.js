/**
 * Login Page - Artists need verification, Listeners don't
 */

class LoginPage {
    render() {
        return `
            <div class="form-container animate-fade-in-up">
                <h2>Login to Bravo Music</h2>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="login-email" required placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="login-password" required placeholder="••••••">
                    </div>
                    <button type="submit" class="btn-primary">Login</button>
                </form>
                <p class="form-footer">
                    <a onclick="window.bravoApp.navigateTo('forgot-password')">Forgot Password?</a>
                </p>
                <p class="form-footer">Don't have an account? <a onclick="window.bravoApp.navigateTo('register')">Register</a></p>
            </div>
        `;
    }

    afterRender() {
        const form = document.getElementById('login-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                
                if (!email || !password) {
                    Toast.show('Please enter email and password', 'warning');
                    return;
                }
                
                Toast.show('Logging in...', 'info');
                
                const auth = new AuthAPI();
                const result = await auth.login({ email, password });
                
                if (result.success) {
                    const user = result.data?.user || auth.getUser();
                    if (user && user.role === 'artist' && !user.isVerified) {
                        Toast.show('Please verify your email first. Check your inbox!', 'warning');
                        return;
                    }
                    Toast.show('Login successful! Welcome back! 🎉', 'success');
                    window.location.reload();
                } else {
                    // Check if error is about email verification
                    if (result.error && result.error.includes('verify your email')) {
                        Toast.show(result.error, 'warning');
                        // Show resend verification option
                        Modal.show({
                            title: 'Email Not Verified',
                            content: `
                                <p>Please verify your email address to access artist features.</p>
                                <p>Didn't receive the verification email?</p>
                                <button id="resend-verify-btn" class="btn-primary">Resend Verification Email</button>
                            `,
                            buttons: [
                                { text: 'Close', class: 'btn-secondary', action: 'close' }
                            ]
                        });
                        
                        setTimeout(() => {
                            const resendBtn = document.getElementById('resend-verify-btn');
                            if (resendBtn) {
                                resendBtn.addEventListener('click', async () => {
                                    const authService = new AuthService();
                                    const result = await authService.resendVerification(email);
                                    if (result.success) {
                                        Toast.show('Verification email sent! Check your inbox.', 'success');
                                    } else {
                                        Toast.show(result.error || 'Failed to send verification', 'error');
                                    }
                                });
                            }
                        }, 100);
                    } else {
                        Toast.show(result.error || 'Login failed', 'error');
                    }
                }
            });
        }
    }
}

window.LoginPage = LoginPage;