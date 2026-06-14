

class UploadPage {
    constructor() {
        this.uploadForm = null;
        this.eligibility = null; // 'loading' | 'ok' | { reason, message, action }
    }

    render() {
        if (!window.authService || !window.authService.isAuthenticated()) {
            return this._renderUnauthenticated();
        }

        const user = window.authService.getUser();
        if (!user) return this._renderUnauthenticated();

        if (user.role !== 'artist' && user.role !== 'admin') {
            return this._renderWrongRole();
        }

        // For artists: must be verified before uploading. (Admins are
        // exempt — they upload on behalf of artists.)
        if (user.role === 'artist' && !user.isVerified) {
            return this._renderUnverified(user.email);
        }

        // Eligibility (subscription/credits) is checked asynchronously
        // in afterRender() so we don't block render. While loading,
        // show the form skeleton.
        return `
            <div class="upload-page-container">
                <h1>Upload Music</h1>
                <div id="eligibility-container">
                    <div class="loading-skeleton" style="padding: 20px; text-align: center; color: #888;">
                        <i class="fas fa-spinner fa-spin"></i> Checking your upload eligibility...
                    </div>
                </div>
            </div>
        `;
    }

    _renderUnauthenticated() {
        return `
            <div class="upload-page-container">
                <div class="upload-error-state" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-lock" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                    <h2>Sign in to upload music</h2>
                    <p style="color: #888; margin-bottom: 24px;">You need an artist account to upload music.</p>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn-primary" onclick="window.bravoApp.navigateTo('login')">Sign In</button>
                        <button class="btn-outline" onclick="window.bravoApp.navigateTo('register')">Create Account</button>
                    </div>
                </div>
            </div>
        `;
    }

    _renderWrongRole() {
        return `
            <div class="upload-page-container">
                <div class="upload-error-state" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-microphone" style="font-size: 64px; color: var(--primary-color); margin-bottom: 20px;"></i>
                    <h2>Artist account required</h2>
                    <p style="color: #888; margin-bottom: 24px;">
                        Only artists can upload music. Your current account is a listener account.
                    </p>
                    <p style="color: #888; margin-bottom: 24px;">
                        To upload your own music, you'll need to create an artist account.
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn-primary" onclick="window.bravoApp.navigateTo('register')">Create Artist Account</button>
                        <button class="btn-outline" onclick="window.bravoApp.navigateTo('browse')">Browse Music Instead</button>
                    </div>
                </div>
            </div>
        `;
    }

    _renderUnverified(email) {
        const safeEmail = this._escapeHtml(email || 'your email');
        return `
            <div class="upload-page-container">
                <div class="upload-error-state" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-envelope" style="font-size: 64px; color: #ff9800; margin-bottom: 20px;"></i>
                    <h2>Verify your email first</h2>
                    <p style="color: #888; margin-bottom: 24px;">
                        We sent a verification link to <strong>${safeEmail}</strong> when you registered.
                        Please verify your email before uploading music.
                    </p>
                    <div id="resend-status" style="margin-bottom: 12px;"></div>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn-primary" id="resend-verification-btn">Resend Verification Email</button>
                        <button class="btn-outline" onclick="window.bravoApp.navigateTo('dashboard')">Go to Dashboard</button>
                    </div>
                </div>
            </div>
        `;
    }

    _renderInsufficient(reason, message, ctaText, ctaPage) {
        return `
            <div class="upload-error-state" style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-exclamation-circle" style="font-size: 64px; color: #ff9800; margin-bottom: 20px;"></i>
                <h2>${this._escapeHtml(reason)}</h2>
                <p style="color: #888; margin-bottom: 24px; max-width: 480px; margin-left: auto; margin-right: auto;">
                    ${this._escapeHtml(message)}
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn-primary" onclick="window.bravoApp.navigateTo('${ctaPage}')">${this._escapeHtml(ctaText)}</button>
                    <button class="btn-outline" onclick="window.bravoApp.navigateTo('dashboard')">Back to Dashboard</button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        // Wire up the resend button if we're on the unverified screen.
        const resendBtn = document.getElementById('resend-verification-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                const user = window.authService.getUser();
                if (!user || !user.email) return;
                resendBtn.disabled = true;
                resendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                const result = await window.authService.resendVerification(user.email);
                const status = document.getElementById('resend-status');
                if (result.success) {
                    if (status) status.innerHTML = '<span style="color: #4caf50;">✓ Sent! Check your inbox.</span>';
                    resendBtn.innerHTML = '<i class="fas fa-check"></i> Sent';
                } else {
                    if (status) status.innerHTML = `<span style="color: #ff4757;">${this._escapeHtml(result.error || 'Failed to send')}</span>`;
                    resendBtn.disabled = false;
                    resendBtn.textContent = 'Try Again';
                }
            });
            return;
        }

        // If we're on the loading screen, run the eligibility check.
        const eligibilityContainer = document.getElementById('eligibility-container');
        if (!eligibilityContainer) return;

        const user = window.authService.getUser();

        // Admins skip eligibility check — they upload on behalf of artists,
        // they don't need subscription/credits themselves.
        if (user.role === 'admin') {
            this._showForm(eligibilityContainer, true);
            return;
        }

        const eligibility = await this._checkArtistEligibility();

        if (eligibility.ok) {
            this._showForm(eligibilityContainer, false);
        } else {
            eligibilityContainer.innerHTML = this._renderInsufficient(
                eligibility.reason,
                eligibility.message,
                eligibility.ctaText,
                eligibility.ctaPage
            );
        }
    }

    
    async _checkArtistEligibility() {
        try {
            const { ok, data, status } = await window.authService.api._request('/artists/subscription', {
                method: 'GET'
            });

            if (!ok) {
                // 404 likely means no Artist profile — treat as needs setup.
                if (status === 404) {
                    return {
                        ok: false,
                        reason: 'Artist profile incomplete',
                        message: 'Complete your artist profile before uploading.',
                        ctaText: 'Complete Profile',
                        ctaPage: 'dashboard'
                    };
                }
                // Treat other errors as transient — let them try anyway.
                return { ok: true };
            }

            const status_ = data.status || 'inactive';
            const expiry = data.expiryDate ? new Date(data.expiryDate) : null;
            const credits = Number(data.uploadCredits || 0);
            const creditsExpiry = data.uploadCreditsExpiry ? new Date(data.uploadCreditsExpiry) : null;

            const hasActiveSub = status_ === 'active' && expiry && expiry > new Date();
            const hasCredits = credits > 0 && creditsExpiry && creditsExpiry > new Date();

            if (hasActiveSub || hasCredits) return { ok: true };

            return {
                ok: false,
                reason: 'No upload capacity',
                message: 'Subscribe to an artist plan or purchase upload credits to start uploading music.',
                ctaText: 'View Subscription Plans',
                ctaPage: 'subscriptions'
            };
        } catch (err) {
            console.warn('Eligibility check failed (will let upload attempt proceed):', err);
            // Don't block the user on transient errors — let them try.
            return { ok: true };
        }
    }

    _showForm(container, isAdmin) {
        container.innerHTML = '<div id="upload-form-container"></div>';
        const formContainer = document.getElementById('upload-form-container');
        if (formContainer) {
            this.uploadForm = new UploadForm('#upload-form-container', isAdmin);
        }
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.UploadPage = UploadPage;
