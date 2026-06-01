/**
 * Admin Settings Page - System Configuration
 */

class AdminSettingsPage {
    constructor() {
        this.settings = null;
        this.isLoading = false;
        this.isSaving = false;
        this.adminAPI = null;
    }

    async render() {
        this.adminAPI = new AdminAPI();
        await this.loadSettings();
        
        return `
            <div class="admin-settings-page">
                <div class="page-header">
                    <h1><i class="fas fa-cog"></i> System Settings</h1>
                    <p>Configure platform settings and preferences</p>
                </div>
                
                <div class="settings-sections">
                    <!-- General Settings -->
                    <div class="settings-card">
                        <h3><i class="fas fa-globe"></i> General Settings</h3>
                        <form id="general-settings-form">
                            <div class="form-group">
                                <label>Platform Name</label>
                                <input type="text" name="platformName" value="Bravo Music" class="form-control">
                                <small>The name of your platform</small>
                            </div>
                            <div class="form-group">
                                <label>Platform URL</label>
                                <input type="text" name="platformUrl" value="${window.APP_CONFIG.API_URL.replace('/api', '')}" class="form-control">
                                <small>Your website URL</small>
                            </div>
                            <div class="form-group">
                                <label>Contact Email</label>
                                <input type="email" name="contactEmail" value="support@bravomusic.com" class="form-control">
                                <small>Support email address</small>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Financial Settings -->
                    <div class="settings-card">
                        <h3><i class="fas fa-chart-line"></i> Financial Settings</h3>
                        <form id="financial-settings-form">
                            <div class="form-group">
                                <label>Platform Commission Rate (%)</label>
                                <input type="number" name="platformCommission" value="${this.settings?.platformCommission || 20}" step="0.5" min="0" max="100" class="form-control">
                                <small>Percentage taken from each transaction</small>
                            </div>
                            <div class="form-group">
                                <label>Minimum Withdrawal Amount (Kwacha)</label>
                                <input type="number" name="minWithdrawalAmount" value="${this.settings?.minWithdrawalAmount || 50}" step="10" min="10" class="form-control">
                                <small>Minimum amount artists can withdraw</small>
                            </div>
                            <div class="form-group">
                                <label>Maximum Upload Size (MB)</label>
                                <input type="number" name="maxUploadSize" value="${this.settings?.maxUploadSize || 50}" step="5" min="10" max="500" class="form-control">
                                <small>Maximum file size for song/video uploads</small>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Subscription Plans -->
                    <div class="settings-card">
                        <h3><i class="fas fa-crown"></i> Artist Subscription Plans</h3>
                        <div class="plans-grid">
                            <div class="plan-card basic">
                                <h4>Basic Plan</h4>
                                <div class="plan-price">K50<span>/month</span></div>
                                <ul class="plan-features">
                                    <li><i class="fas fa-check"></i> 10 Uploads per month</li>
                                    <li><i class="fas fa-check"></i> Basic Analytics</li>
                                    <li><i class="fas fa-check"></i> Email Support</li>
                                </ul>
                                <button class="btn-outline edit-plan" data-plan="basic">Edit</button>
                            </div>
                            <div class="plan-card pro">
                                <h4>Pro Plan</h4>
                                <div class="plan-price">K120<span>/month</span></div>
                                <ul class="plan-features">
                                    <li><i class="fas fa-check"></i> Unlimited Uploads</li>
                                    <li><i class="fas fa-check"></i> Advanced Analytics</li>
                                    <li><i class="fas fa-check"></i> Monetization</li>
                                    <li><i class="fas fa-check"></i> Priority Support</li>
                                </ul>
                                <button class="btn-outline edit-plan" data-plan="pro">Edit</button>
                            </div>
                            <div class="plan-card vip">
                                <h4>VIP Plan</h4>
                                <div class="plan-price">K300<span>/month</span></div>
                                <ul class="plan-features">
                                    <li><i class="fas fa-check"></i> Verified Badge</li>
                                    <li><i class="fas fa-check"></i> Homepage Promotion</li>
                                    <li><i class="fas fa-check"></i> Unlimited Uploads</li>
                                    <li><i class="fas fa-check"></i> 24/7 Priority Support</li>
                                </ul>
                                <button class="btn-outline edit-plan" data-plan="vip">Edit</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Maintenance Settings -->
                    <div class="settings-card">
                        <h3><i class="fas fa-tools"></i> Maintenance</h3>
                        <div class="maintenance-options">
                            <div class="option-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="maintenance-mode"> Enable Maintenance Mode
                                </label>
                                <small>When enabled, only admins can access the site</small>
                            </div>
                            <div class="option-group">
                                <button type="button" id="clear-cache-btn" class="btn-warning">
                                    <i class="fas fa-trash"></i> Clear System Cache
                                </button>
                            </div>
                            <div class="option-group">
                                <button type="button" id="trigger-backup-btn" class="btn-primary">
                                    <i class="fas fa-database"></i> Manual Backup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-actions">
                    <button id="save-all-settings" class="btn-primary btn-large">
                        <i class="fas fa-save"></i> Save All Settings
                    </button>
                    <button id="reset-settings" class="btn-outline">
                        <i class="fas fa-undo"></i> Reset to Default
                    </button>
                </div>
            </div>
        `;
    }

    async loadSettings() {
        this.isLoading = true;
        
        try {
            const result = await this.adminAPI.getSystemSettings();
            if (!result.error) {
                this.settings = result;
            }
        } catch (error) {
            console.error('Load settings error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async afterRender() {
        this.attachEventListeners();
        this.loadMaintenanceModeStatus();
    }

    attachEventListeners() {
        const saveBtn = document.getElementById('save-all-settings');
        const resetBtn = document.getElementById('reset-settings');
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        const backupBtn = document.getElementById('trigger-backup-btn');
        const maintenanceMode = document.getElementById('maintenance-mode');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await this.saveAllSettings();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (confirm('Reset all settings to default values?')) {
                    await this.resetSettings();
                }
            });
        }
        
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                const result = await this.adminAPI.clearCache?.();
                if (!result?.error) {
                    Toast.show('Cache cleared successfully', 'success');
                } else {
                    Toast.show('Failed to clear cache', 'error');
                }
            });
        }
        
        if (backupBtn) {
            backupBtn.addEventListener('click', async () => {
                Toast.show('Creating backup...', 'info');
                const result = await this.adminAPI.triggerBackup();
                if (!result.error) {
                    Toast.show('Backup created successfully!', 'success');
                } else {
                    Toast.show('Backup failed: ' + result.error, 'error');
                }
            });
        }
        
        if (maintenanceMode) {
            maintenanceMode.addEventListener('change', async () => {
                await this.toggleMaintenanceMode(maintenanceMode.checked);
            });
        }
        
        document.querySelectorAll('.edit-plan').forEach(btn => {
            btn.addEventListener('click', () => {
                const plan = btn.dataset.plan;
                this.editPlanModal(plan);
            });
        });
    }

    loadMaintenanceModeStatus() {
        const maintenanceMode = document.getElementById('maintenance-mode');
        if (maintenanceMode) {
            const isMaintenance = localStorage.getItem('maintenance_mode') === 'true';
            maintenanceMode.checked = isMaintenance;
        }
    }

    async saveAllSettings() {
        this.isSaving = true;
        
        const generalForm = document.getElementById('general-settings-form');
        const financialForm = document.getElementById('financial-settings-form');
        
        const formData = {
            platformCommission: parseFloat(financialForm.querySelector('[name="platformCommission"]').value),
            minWithdrawalAmount: parseFloat(financialForm.querySelector('[name="minWithdrawalAmount"]').value),
            maxUploadSize: parseFloat(financialForm.querySelector('[name="maxUploadSize"]').value),
            platformName: generalForm.querySelector('[name="platformName"]').value,
            platformUrl: generalForm.querySelector('[name="platformUrl"]').value,
            contactEmail: generalForm.querySelector('[name="contactEmail"]').value
        };
        
        try {
            const result = await this.adminAPI.updateSystemSettings(formData);
            if (!result.error) {
                Toast.show('Settings saved successfully!', 'success');
            } else {
                Toast.show(result.error, 'error');
            }
        } catch (error) {
            Toast.show('Failed to save settings', 'error');
        } finally {
            this.isSaving = false;
        }
    }

    async resetSettings() {
        const defaultSettings = {
            platformCommission: 20,
            minWithdrawalAmount: 50,
            maxUploadSize: 50
        };
        
        try {
            const result = await this.adminAPI.updateSystemSettings(defaultSettings);
            if (!result.error) {
                Toast.show('Settings reset to default', 'success');
                await this.loadSettings();
                await this.render();
                await this.afterRender();
            } else {
                Toast.show(result.error, 'error');
            }
        } catch (error) {
            Toast.show('Failed to reset settings', 'error');
        }
    }

    async toggleMaintenanceMode(enabled) {
        localStorage.setItem('maintenance_mode', enabled);
        Toast.show(enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled', 'info');
    }

    editPlanModal(plan) {
        const plans = {
            basic: { name: 'Basic Plan', price: 50, uploads: 10 },
            pro: { name: 'Pro Plan', price: 120, uploads: -1 },
            vip: { name: 'VIP Plan', price: 300, uploads: -1 }
        };
        
        const planData = plans[plan];
        
        Modal.show({
            title: `Edit ${planData.name}`,
            content: `
                <form id="edit-plan-form">
                    <div class="form-group">
                        <label>Plan Name</label>
                        <input type="text" name="name" value="${planData.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Price (Kwacha/month)</label>
                        <input type="number" name="price" value="${planData.price}" step="10" min="0" required>
                    </div>
                    <div class="form-group">
                        <label>Upload Limit</label>
                        <input type="number" name="uploads" value="${planData.uploads === -1 ? 999 : planData.uploads}" step="5" min="-1">
                        <small>-1 means unlimited</small>
                    </div>
                </form>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Save Changes', class: 'btn-primary', action: 'save', onClick: () => {
                    Toast.show(`Plan updated! (This would save to database)`, 'success');
                }}
            ]
        });
    }
}

window.AdminSettingsPage = AdminSettingsPage;