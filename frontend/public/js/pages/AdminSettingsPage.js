

class AdminSettingsPage {
    constructor() {
        this.settings = null;
        this.adminAPI = new AdminAPI();
    }

    async render() {
        return `
            <div class="admin-settings-page">
                <div class="page-header">
                    <h1><i class="fas fa-cog"></i> System Settings</h1>
                    <p>Configure platform-wide settings and limits.</p>
                </div>

                <div id="as-status" style="margin-bottom:12px;"></div>

                <div class="settings-sections" style="display:grid; gap:16px;">

                    <div class="settings-card">
                        <h3><i class="fas fa-globe"></i> General</h3>
                        <form id="ag-general-form" novalidate>
                            <div class="form-group">
                                <label for="ag-platform-name">Platform Name</label>
                                <input type="text" id="ag-platform-name" maxlength="100">
                            </div>
                            <div class="form-group">
                                <label for="ag-platform-url">Platform URL</label>
                                <input type="url" id="ag-platform-url" maxlength="200">
                            </div>
                            <div class="form-group">
                                <label for="ag-contact-email">Contact Email</label>
                                <input type="email" id="ag-contact-email" maxlength="200">
                            </div>
                        </form>
                    </div>

                    <div class="settings-card">
                        <h3><i class="fas fa-chart-line"></i> Financial</h3>
                        <form id="ag-financial-form" novalidate>
                            <div class="form-group">
                                <label for="ag-commission">Platform Commission (%)</label>
                                <input type="number" id="ag-commission" step="0.5" min="0" max="50">
                                <small>Percent taken from each artist sale / withdrawal.</small>
                            </div>
                            <div class="form-group">
                                <label for="ag-min-withdrawal">Minimum Withdrawal (Kwacha)</label>
                                <input type="number" id="ag-min-withdrawal" step="10" min="10">
                            </div>
                            <div class="form-group">
                                <label for="ag-max-upload">Max Upload Size (MB)</label>
                                <input type="number" id="ag-max-upload" step="5" min="5" max="500">
                            </div>
                            <div class="form-group">
                                <label for="ag-subscription-price">Premium Subscription Price (Kwacha / month)</label>
                                <input type="number" id="ag-subscription-price" step="1" min="0">
                            </div>
                        </form>
                    </div>

                    <div class="settings-card">
                        <h3><i class="fas fa-music"></i> Content</h3>
                        <div class="form-group">
                            <label>Allowed Genres</label>
                            <div id="ag-genre-list" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
                            <small>Genres are defined in the canonical list and cannot be edited from here. To change, edit <code>backend/utils/genres.js</code>.</small>
                        </div>
                    </div>

                    <div class="settings-card">
                        <h3><i class="fas fa-tools"></i> Maintenance</h3>
                        <form id="ag-maintenance-form" novalidate>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="ag-maintenance-mode">
                                    Enable Maintenance Mode
                                </label>
                                <small>When enabled, only admins can access the site.</small>
                            </div>
                        </form>
                        <div style="display:flex; gap:8px; margin-top:12px;">
                            <button type="button" class="btn-outline" id="ag-backup-btn">
                                <i class="fas fa-database"></i> Trigger Backup
                            </button>
                        </div>
                    </div>

                    <div class="settings-card" style="opacity:0.7;">
                        <h3><i class="fas fa-crown"></i> Subscription Plans</h3>
                        <p style="color:#888;">Subscription plan management is part of the Wallet & Subscriptions batch (coming soon). The current premium price above will be used until then.</p>
                    </div>
                </div>

                <div class="settings-actions" style="margin-top:24px; display:flex; gap:8px;">
                    <button class="btn-primary" type="button" id="ag-save-btn">
                        <i class="fas fa-save"></i> Save All Settings
                    </button>
                    <button class="btn-outline" type="button" id="ag-reload-btn">
                        <i class="fas fa-sync-alt"></i> Reload from Server
                    </button>
                </div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAdmin?.()) {
            Toast.show?.('Admin access required', 'error');
            return;
        }
        await this._loadSettings();
        this._populateForm();
        this._renderGenres();
        this._wireButtons();
    }

    async _loadSettings() {
        const statusEl = document.getElementById('as-status');
        const result = await this.adminAPI.getSystemSettings();
        if (!result.success) {
            this.settings = {};
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="warning-message" style="background:rgba(255,196,0,0.1); padding:12px; border-radius:6px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Could not load settings from server (${this._escapeHtml(result.error || 'unknown error')}).
                        Make sure the SystemSettings backend patch from batch 6 is applied.
                    </div>
                `;
            }
            return;
        }
        const data = result.data || {};
        this.settings = data.settings || data;
        if (statusEl) statusEl.innerHTML = '';
    }

    _populateForm() {
        const s = this.settings || {};
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el && val != null) el.value = val;
        };
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };

        set('ag-platform-name', s.platformName || 'Bravo Music');
        set('ag-platform-url', s.platformUrl || '');
        set('ag-contact-email', s.contactEmail || '');
        set('ag-commission', s.platformCommission ?? 10);
        set('ag-min-withdrawal', s.minWithdrawalAmount ?? 50);
        set('ag-max-upload', s.maxUploadSize ?? 20);
        set('ag-subscription-price', s.subscriptionPrice ?? 30);
        setCheck('ag-maintenance-mode', s.maintenanceMode === true);
    }

    _renderGenres() {
        const list = document.getElementById('ag-genre-list');
        if (!list) return;
        const genres = Array.isArray(window.GENRES) ? window.GENRES : [];
        list.innerHTML = '';
        genres.forEach(g => {
            const span = document.createElement('span');
            span.className = 'badge badge-secondary';
            span.style.cssText = 'padding:4px 8px; background:rgba(108,99,255,0.1); border-radius:4px; font-size:13px;';
            span.textContent = g;
            list.appendChild(span);
        });
        if (genres.length === 0) {
            list.innerHTML = '<small style="color:#888;">No genres loaded — config.js may not be configured.</small>';
        }
    }

    _wireButtons() {
        document.getElementById('ag-save-btn')?.addEventListener('click', () => this._saveSettings());
        document.getElementById('ag-reload-btn')?.addEventListener('click', async () => {
            await this._loadSettings();
            this._populateForm();
            Toast.show?.('Settings reloaded', 'success');
        });
        document.getElementById('ag-backup-btn')?.addEventListener('click', () => this._triggerBackup());
    }

    async _saveSettings() {
        const saveBtn = document.getElementById('ag-save-btn');
        const platformName = document.getElementById('ag-platform-name').value.trim();
        const platformUrl = document.getElementById('ag-platform-url').value.trim();
        const contactEmail = document.getElementById('ag-contact-email').value.trim();
        const platformCommission = parseFloat(document.getElementById('ag-commission').value || '0');
        const minWithdrawalAmount = parseFloat(document.getElementById('ag-min-withdrawal').value || '0');
        const maxUploadSize = parseInt(document.getElementById('ag-max-upload').value || '0', 10);
        const subscriptionPrice = parseFloat(document.getElementById('ag-subscription-price').value || '0');
        const maintenanceMode = document.getElementById('ag-maintenance-mode').checked;

        // Basic client-side validation
        if (!platformName) { Toast.show?.('Platform name required', 'warning'); return; }
        if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
            Toast.show?.('Invalid contact email', 'warning');
            return;
        }
        if (platformUrl && !/^https?:\/\//i.test(platformUrl)) {
            Toast.show?.('Platform URL must start with http(s)://', 'warning');
            return;
        }
        if (!Number.isFinite(platformCommission) || platformCommission < 0 || platformCommission > 50) {
            Toast.show?.('Commission must be between 0 and 50', 'warning');
            return;
        }
        if (!Number.isFinite(minWithdrawalAmount) || minWithdrawalAmount < 10) {
            Toast.show?.('Min withdrawal must be at least 10', 'warning');
            return;
        }
        if (!Number.isFinite(maxUploadSize) || maxUploadSize < 5 || maxUploadSize > 500) {
            Toast.show?.('Max upload size must be between 5 and 500 MB', 'warning');
            return;
        }
        if (!Number.isFinite(subscriptionPrice) || subscriptionPrice < 0) {
            Toast.show?.('Subscription price must be non-negative', 'warning');
            return;
        }

        const payload = {
            platformName,
            platformUrl,
            contactEmail,
            platformCommission,
            minWithdrawalAmount,
            maxUploadSize,
            subscriptionPrice,
            maintenanceMode
        };

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        const result = await this.adminAPI.updateSystemSettings(payload);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Settings';
        }

        if (!result.success) {
            Toast.show?.(result.error || 'Save failed', 'error');
            return;
        }

        // Echo from server back into the form so any normalization is visible.
        const data = result.data || {};
        this.settings = data.settings || data || payload;
        this._populateForm();
        Toast.show?.('Settings saved', 'success');
    }

    async _triggerBackup() {
        const btn = document.getElementById('ag-backup-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Backing up...';
        }
        const result = await this.adminAPI.triggerBackup();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-database"></i> Trigger Backup';
        }
        if (result.success) {
            Toast.show?.('Backup triggered', 'success');
        } else {
            Toast.show?.(result.error || 'Backup failed', 'error');
        }
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.AdminSettingsPage = AdminSettingsPage;
