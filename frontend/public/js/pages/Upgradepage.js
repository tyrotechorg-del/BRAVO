

class UpgradePage {
    constructor() {
        this.userAPI = new UserAPI();
        this.submitting = false;
    }

    async render() {
        const user = window.authService?.getUser?.();

        // Already upgraded? Bounce.
        if (user?.role === 'artist' || user?.role === 'admin') {
            setTimeout(() => {
                Toast.show?.('You\u2019re already an artist!', 'info');
                if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('dashboard');
                else window.location.hash = 'dashboard';
            }, 50);
            return '<div class="loading-container"><div class="spinner"></div></div>';
        }

        const genres = window.GENRES || ['Afrobeat', 'Amapiano', 'Hip Hop', 'R&B', 'Gospel'];
        const genreCheckboxes = genres.map(g => `
            <label style="display:inline-flex; align-items:center; gap:6px; background:#1a1a2e; border:1px solid #2a2a3e; padding:6px 12px; border-radius:16px; cursor:pointer; font-size:14px;">
                <input type="checkbox" name="up-genres" value="${this._escapeAttr(g)}">
                ${this._escapeHtml(g)}
            </label>
        `).join('');

        return `
            <div class="upgrade-page" style="max-width:680px; margin:0 auto;">
                <div style="background:linear-gradient(135deg, #6c63ff, #9b59b6); border-radius:16px; padding:32px; color:white; margin-bottom:24px; text-align:center;">
                    <i class="fas fa-crown" style="font-size:48px; margin-bottom:12px;"></i>
                    <h1 style="margin:0 0 8px;">Become an Artist</h1>
                    <p style="margin:0; opacity:0.9;">Share your music with the world. Upload tracks, earn royalties, and connect with fans.</p>
                </div>

                <div style="background:#1a1a2e; border-radius:12px; padding:24px;">
                    <h3 style="margin:0 0 16px;">What you get</h3>
                    <ul style="margin:0; padding-left:20px; color:#bbb; line-height:1.8;">
                        <li>Upload songs, albums, and music videos</li>
                        <li>Track streams, downloads, and earnings in real time</li>
                        <li>Get paid via mobile money (PawaPay) on every paid stream/download</li>
                        <li>Build a profile with followers, social links, and a verified badge (after admin review)</li>
                    </ul>
                </div>

                <form id="up-form" style="background:#1a1a2e; border-radius:12px; padding:24px; margin-top:24px;" onsubmit="return false;">
                    <h3 style="margin:0 0 16px;">Your artist profile</h3>

                    <div class="form-group">
                        <label>Stage name <span style="color:#ff4757;">*</span></label>
                        <input type="text" id="up-stagename" required maxlength="60" placeholder="The name your fans will see">
                    </div>

                    <div class="form-group">
                        <label>Bio <span style="color:#ff4757;">*</span></label>
                        <textarea id="up-bio" rows="4" maxlength="1000" required placeholder="Tell us about your music, your influences, your story"></textarea>
                        <small style="color:#888;"><span id="up-bio-count">0</span> / 1000</small>
                    </div>

                    <div class="form-group">
                        <label>Primary genres <span style="color:#ff4757;">*</span></label>
                        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                            ${genreCheckboxes}
                        </div>
                        <small style="color:#888;">Pick at least one</small>
                    </div>

                    <h4 style="margin:24px 0 12px;">Social links (optional)</h4>

                    <div class="form-group">
                        <label>Instagram</label>
                        <input type="text" id="up-instagram" placeholder="@yourhandle or full URL" maxlength="100">
                    </div>

                    <div class="form-group">
                        <label>Twitter / X</label>
                        <input type="text" id="up-twitter" placeholder="@yourhandle or full URL" maxlength="100">
                    </div>

                    <div class="form-group">
                        <label>YouTube</label>
                        <input type="text" id="up-youtube" placeholder="Channel URL" maxlength="200">
                    </div>

                    <div class="form-group">
                        <label>Website</label>
                        <input type="url" id="up-website" placeholder="https://" maxlength="200">
                    </div>

                    <div id="up-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>

                    <div style="display:flex; gap:12px; margin-top:24px;">
                        <button type="button" class="btn-secondary" id="up-cancel-btn">Cancel</button>
                        <button type="submit" class="btn-primary" id="up-submit-btn" style="flex:1;">
                            <i class="fas fa-crown"></i> Submit Application
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in to upgrade your account', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        const bio = document.getElementById('up-bio');
        const bioCount = document.getElementById('up-bio-count');
        bio?.addEventListener('input', () => {
            if (bioCount) bioCount.textContent = String(bio.value.length);
        });

        document.getElementById('up-cancel-btn')?.addEventListener('click', () => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('home');
            else window.location.hash = 'home';
        });

        document.getElementById('up-submit-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await this._submit();
        });
    }

    async _submit() {
        if (this.submitting) return;

        const get = (id) => document.getElementById(id);
        const stageName = get('up-stagename')?.value.trim() || '';
        const bioVal = get('up-bio')?.value.trim() || '';
        const genres = Array.from(document.querySelectorAll('input[name="up-genres"]:checked')).map(el => el.value);
        const instagram = get('up-instagram')?.value.trim() || '';
        const twitter = get('up-twitter')?.value.trim() || '';
        const youtube = get('up-youtube')?.value.trim() || '';
        const website = get('up-website')?.value.trim() || '';

        const errorEl = get('up-error');
        const showError = (msg) => {
            if (errorEl) errorEl.textContent = msg;
            else if (msg) Toast.show?.(msg, 'error');
        };
        showError('');

        if (stageName.length < 2) { showError('Stage name must be at least 2 characters'); return; }
        if (bioVal.length < 30) { showError('Bio must be at least 30 characters'); return; }
        if (genres.length === 0) { showError('Pick at least one genre'); return; }

        const submitBtn = get('up-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        }
        this.submitting = true;

        const payload = {
            stageName,
            bio: bioVal,
            genres,
            socialLinks: { instagram, twitter, youtube, website }
        };

        const result = await this.userAPI.upgradeToArtist(payload);

        this.submitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-crown"></i> Submit Application';
        }

        if (!result.success) {
            showError(result.error || 'Failed to upgrade. Please try again.');
            return;
        }

        // Backend returns { user, artist }
        const updatedUser = result.data?.user;
        if (updatedUser) {
            window.authService?.setUser?.(updatedUser);
        }

        Toast.show?.('You\u2019re now an artist!', 'success', 4000);

        // Send them to the artist dashboard.
        setTimeout(() => {
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('dashboard');
            else window.location.hash = 'dashboard';
        }, 600);
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    _escapeAttr(text) {
        return this._escapeHtml(text);
    }
}

window.UpgradePage = UpgradePage;
