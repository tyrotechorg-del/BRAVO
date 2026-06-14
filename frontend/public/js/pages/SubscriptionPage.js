

class SubscriptionPage {
    constructor() {
        this.plans = [];
        this.currentSubscription = null;
        this.subscriptionsAPI = new SubscriptionsAPI();
    }

    async render() {
        return `
            <div class="subscription-page">
                <div class="page-header">
                    <h1><i class="fas fa-crown"></i> Subscription</h1>
                    <p>Unlock premium features.</p>
                </div>

                <div id="sub-current-container" aria-live="polite"></div>

                <h2 style="margin-top:32px;">Available Plans</h2>
                <div id="sub-plans-container" aria-live="polite">
                    <div class="loading-container"><div class="spinner"></div></div>
                </div>

                <div id="sub-history-link" style="margin-top:24px; text-align:center;"></div>
            </div>
        `;
    }

    async afterRender() {
        if (!window.authService?.isAuthenticated?.()) {
            Toast.show?.('Please sign in to view subscription options', 'info');
            if (window.bravoApp?.navigateTo) window.bravoApp.navigateTo('login');
            return;
        }

        await Promise.all([
            this._loadCurrentSubscription(),
            this._loadPlans()
        ]);
        this._renderCurrent();
        this._renderPlans();
        this._renderHistoryLink();
    }

    async _loadCurrentSubscription() {
        const result = await this.subscriptionsAPI.getMySubscription();
        if (result.success) {
            const data = result.data || {};
            // Tolerate both { subscription } envelope and direct payload
            this.currentSubscription = data.subscription || data;
        } else {
            this.currentSubscription = null;
        }
    }

    async _loadPlans() {
        const result = await this.subscriptionsAPI.getPlans();
        if (result.success) {
            const data = result.data;
            // Backend can return either an array or { plans }
            let plans = Array.isArray(data) ? data : (data?.plans || []);

            // If backend returned an object map { artist_basic: {...}, ... }
            if (!Array.isArray(plans) && plans && typeof plans === 'object') {
                plans = Object.entries(plans).map(([id, info]) => ({ id, ...info }));
            }

            this.plans = plans.filter(p => p && (p.id || p._id));
        } else {
            // Fallback to local config
            this.plans = this._fallbackPlans();
        }

        // Filter plans by user role
        const role = window.authService?.getUser?.()?.role || 'listener';
        this.plans = this._filterPlansByRole(this.plans, role);
    }

    _fallbackPlans() {
        const list = [];
        const localPlans = window.SUBSCRIPTION_PLANS || {};
        Object.entries(localPlans).forEach(([id, info]) => {
            list.push({ id, ...info });
        });
        // Add listener_premium if not present (since legacy config didn't include it)
        if (!list.find(p => p.id === 'listener_premium')) {
            list.push({
                id: 'listener_premium',
                name: 'Premium Listener',
                price: 50,
                features: [
                    'Unlimited ad-free streaming',
                    'Higher audio quality',
                    'Offline downloads',
                    'Skip premium song fees'
                ]
            });
        }
        return list;
    }

    _filterPlansByRole(plans, role) {
        if (role === 'admin') return plans;
        if (role === 'artist') {
            return plans.filter(p => /^artist_/.test(String(p.id || '')));
        }
        // listener
        return plans.filter(p => /^listener_/.test(String(p.id || '')));
    }

    // Render: current subscription
    _renderCurrent() {
        const container = document.getElementById('sub-current-container');
        if (!container) return;

        const sub = this.currentSubscription;
        const isActive = sub && (sub.status === 'active' || sub.status === 'trialing');

        if (!isActive) {
            container.innerHTML = `
                <div class="info-card" style="background:rgba(108,99,255,0.05); padding:16px; border-radius:8px;">
                    <p style="margin:0;"><i class="fas fa-info-circle"></i> You don't have an active subscription. Pick a plan below to subscribe.</p>
                </div>
            `;
            return;
        }

        const planName = this._escapeHtml(sub.planName || sub.plan?.name || sub.planId || 'Plan');
        const expiresAt = sub.expiresAt || sub.currentPeriodEnd;
        const expiresStr = expiresAt ? new Date(expiresAt).toLocaleDateString() : 'unknown';
        const autoRenew = !!sub.autoRenew;
        const safeStatus = this._escapeHtml(sub.status || 'active');

        container.innerHTML = `
            <div class="current-subscription-card" style="background: linear-gradient(135deg, #6c63ff, #4d44ff); color:white; padding:24px; border-radius:12px;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <div style="font-size:14px; opacity:0.8;">Current Plan</div>
                        <div style="font-size:28px; font-weight:bold; margin: 8px 0;">${planName}</div>
                        <div style="font-size:14px;">
                            <i class="fas fa-calendar"></i> Renews on ${this._escapeHtml(expiresStr)}
                        </div>
                        <div style="font-size:12px; opacity:0.8; margin-top:4px;">
                            Status: ${safeStatus} · Auto-renew: ${autoRenew ? 'ON' : 'OFF'}
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button class="btn-light btn-sm" type="button" id="sub-toggle-renew">
                            ${autoRenew ? 'Turn Auto-Renew Off' : 'Turn Auto-Renew On'}
                        </button>
                        <button class="btn-danger btn-sm" type="button" id="sub-cancel-btn">
                            Cancel Subscription
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('sub-toggle-renew')?.addEventListener('click', () => this._toggleAutoRenew());
        document.getElementById('sub-cancel-btn')?.addEventListener('click', () => this._confirmCancel());
    }

    // Render: plans grid
    _renderPlans() {
        const container = document.getElementById('sub-plans-container');
        if (!container) return;

        if (this.plans.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-crown"></i>
                    <h3>No plans available</h3>
                    <p>Subscription plans aren't configured yet. Check back soon.</p>
                </div>
            `;
            return;
        }

        const currentPlanId = this.currentSubscription?.planId || this.currentSubscription?.plan?.id;

        container.innerHTML = '';
        container.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px;';
        this.plans.forEach(plan => container.appendChild(this._buildPlanCard(plan, currentPlanId)));
    }

    _buildPlanCard(plan, currentPlanId) {
        const id = String(plan.id || plan._id);
        const name = this._escapeHtml(plan.name || id);
        const price = Number(plan.price || 0);
        const features = Array.isArray(plan.features) ? plan.features : [];
        const isCurrent = id === currentPlanId;

        const card = document.createElement('div');
        card.className = 'plan-card';
        card.style.cssText = `
            background: white;
            border: 2px solid ${isCurrent ? '#6c63ff' : '#eee'};
            border-radius: 12px;
            padding: 24px;
            display: flex;
            flex-direction: column;
        `;

        const featuresHtml = features.length > 0
            ? features.map(f => `<li style="margin: 4px 0;"><i class="fas fa-check" style="color:#2ed573; margin-right:6px;"></i>${this._escapeHtml(f)}</li>`).join('')
            : '<li style="color:#888;">No feature list available.</li>';

        card.innerHTML = `
            <h3 style="margin-top:0;">${name}</h3>
            <div style="font-size:28px; font-weight:bold; margin: 8px 0;">K${price.toFixed(2)}<span style="font-size:14px; color:#888;">/month</span></div>
            <ul style="list-style:none; padding:0; margin: 12px 0; flex: 1;">${featuresHtml}</ul>
            <button class="${isCurrent ? 'btn-secondary' : 'btn-primary'}" type="button" data-action="subscribe" data-plan-id="${this._escapeAttr(id)}" ${isCurrent ? 'disabled' : ''}>
                ${isCurrent ? 'Current Plan' : 'Subscribe'}
            </button>
        `;

        card.querySelector('[data-action="subscribe"]')?.addEventListener('click', () => {
            if (isCurrent) return;
            this._openSubscribeFlow(plan);
        });

        return card;
    }

    _renderHistoryLink() {
        const container = document.getElementById('sub-history-link');
        if (!container) return;
        container.innerHTML = `
            <a href="#payment-history" class="btn-link"><i class="fas fa-history"></i> View payment history</a>
        `;
    }

    // Subscribe flow
    _openSubscribeFlow(plan) {
        const name = plan.name || plan.id;
        const price = Number(plan.price || 0);

        PaymentFlowModal.show({
            title: `Subscribe to ${name}`,
            summary: `You're subscribing to ${name} at K${price.toFixed(2)}/month. The first month will be charged now; renewals happen automatically unless you cancel.`,
            amount: price,
            onConfirm: async ({ phoneNumber, method }) => {
                const result = await this.subscriptionsAPI.subscribe(plan.id, method, phoneNumber);
                if (!result.success) {
                    return { error: result.error || 'Failed to start subscription' };
                }
                const data = result.data || {};
                return {
                    reference: data.reference || data.paymentReference || data.subscription?.reference,
                    data
                };
            },
            onSuccess: async () => {
                Toast.show?.(`Subscribed to ${name}`, 'success');
                await this._loadCurrentSubscription();
                this._renderCurrent();
                this._renderPlans();
            },
            onFailure: ({ message }) => {
                Toast.show?.(message || 'Subscription failed', 'error');
            }
        });
    }

    // Cancel + auto-renew toggle
    _confirmCancel() {
        const doCancel = async () => {
            const result = await this.subscriptionsAPI.cancelSubscription();
            if (!result.success) {
                Toast.show?.(result.error || 'Failed to cancel', 'error');
                return;
            }
            Toast.show?.('Subscription cancelled. You retain access until the end of the period.', 'info');
            await this._loadCurrentSubscription();
            this._renderCurrent();
            this._renderPlans();
        };
        const sub = this.currentSubscription;
        const expiresAt = sub?.expiresAt || sub?.currentPeriodEnd;
        const expiresStr = expiresAt ? new Date(expiresAt).toLocaleDateString() : 'the end of the current period';
        const msg = `Cancel your subscription? You'll keep access until ${expiresStr}, but it won't renew.`;

        if (window.Modal?.confirm) Modal.confirm(msg, doCancel);
        else if (confirm(msg)) doCancel();
    }

    async _toggleAutoRenew() {
        const newAutoRenew = !this.currentSubscription?.autoRenew;
        const btn = document.getElementById('sub-toggle-renew');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Updating...';
        }

        const result = await this.subscriptionsAPI.renewSubscription(newAutoRenew);
        if (btn) btn.disabled = false;

        if (!result.success) {
            Toast.show?.(result.error || 'Failed to update auto-renew', 'error');
            this._renderCurrent();   // restore button text from current state
            return;
        }

        Toast.show?.(`Auto-renew turned ${newAutoRenew ? 'on' : 'off'}`, 'success');
        await this._loadCurrentSubscription();
        this._renderCurrent();
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

window.SubscriptionPage = SubscriptionPage;
