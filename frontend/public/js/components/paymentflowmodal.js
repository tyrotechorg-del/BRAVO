

class PaymentFlowModal {

    /**
     * Show the payment flow modal.
     *
     * @param {object} opts
     *   - {string} title - Modal title
     *   - {string} summary - Description shown to user
     *   - {number} amount - Amount in Kwacha (displayed for confirmation)
     *   - {function} onConfirm - Async callback that initiates the payment;
     *       receives { phoneNumber, method }, returns { reference?, error? }
     *   - {function} onSuccess - Called on completed payment with the final data
     *   - {function} onFailure - Called on failed payment with reason
     */
    static show(opts) {
        const instance = new PaymentFlowModal(opts);
        instance._render();
        return instance;
    }

    constructor(opts) {
        this.opts = opts || {};
        this.handle = null;
        this.abortController = new AbortController();
        this.paymentsAPI = new PaymentsAPI();
        this.state = 'idle';   // idle | submitting | polling | success | failure
    }

    _render() {
        const safeTitle = this._escapeHtml(this.opts.title || 'Confirm Payment');
        const safeSummary = this._escapeHtml(this.opts.summary || '');
        const amount = Number(this.opts.amount || 0);

        this.handle = Modal.show({
            title: safeTitle,
            content: `
                <div class="payment-flow-modal">
                    <div id="pfm-step-confirm">
                        <p>${safeSummary}</p>
                        ${amount > 0 ? `<p><strong>Amount:</strong> K${amount.toFixed(2)}</p>` : ''}

                        <form id="pfm-form" novalidate>
                            <div class="form-group">
                                <label for="pfm-method">Payment Method *</label>
                                <select id="pfm-method" required>
                                    <option value="mtn_money">MTN Mobile Money</option>
                                    <option value="airtel_money">Airtel Money</option>
                                    <option value="zamtel_kwacha">Zamtel Kwacha</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="pfm-phone">Phone Number *</label>
                                <input type="tel" id="pfm-phone" required maxlength="13" placeholder="0977 123 456">
                                <small style="color:#888;">
                                    Format: 097/096/095/077/076/075 + 7 digits.
                                </small>
                            </div>
                            <div id="pfm-error" style="color:#ff4757; font-size:14px; margin-top:8px;"></div>
                        </form>
                    </div>

                    <div id="pfm-step-polling" hidden style="text-align:center; padding:24px 0;">
                        <div class="spinner" style="margin: 0 auto 16px;"></div>
                        <h3 id="pfm-poll-title">Check your phone</h3>
                        <p id="pfm-poll-message">A payment request has been sent. Please approve it on your phone to complete the transaction.</p>
                        <p style="color:#888; font-size:13px; margin-top:16px;">
                            This usually takes 30–60 seconds. Don't close this window.
                        </p>
                        <p id="pfm-poll-status" style="margin-top:12px;"></p>
                    </div>

                    <div id="pfm-step-success" hidden style="text-align:center; padding:24px 0;">
                        <i class="fas fa-check-circle" style="font-size:48px; color:#2ed573; margin-bottom:12px;"></i>
                        <h3>Payment successful</h3>
                        <p id="pfm-success-message">Your transaction has been completed.</p>
                    </div>

                    <div id="pfm-step-failure" hidden style="text-align:center; padding:24px 0;">
                        <i class="fas fa-times-circle" style="font-size:48px; color:#ff4757; margin-bottom:12px;"></i>
                        <h3>Payment failed</h3>
                        <p id="pfm-failure-message">The transaction could not be completed.</p>
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', action: 'cancel' },
                { text: 'Confirm Payment', class: 'btn-primary', action: 'submit' }
            ]
        });

        // Wire the modal AFTER mount.
        requestAnimationFrame(() => {
            const submitBtn = this.handle?.element?.querySelector('[data-action="submit"]');
            submitBtn?.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this._submit();
            });

            // Hook into modal close to abort polling
            const cancelBtn = this.handle?.element?.querySelector('[data-action="cancel"]');
            cancelBtn?.addEventListener('click', () => {
                this._abort();
            });
        });
    }

    async _submit() {
        const errorEl = document.getElementById('pfm-error');
        errorEl.textContent = '';

        const method = document.getElementById('pfm-method').value;
        const phoneNumber = document.getElementById('pfm-phone').value.trim();

        if (!this._isValidZambiaPhone(phoneNumber)) {
            errorEl.textContent = 'Enter a valid Zambian mobile number';
            return;
        }
        if (!method) {
            errorEl.textContent = 'Select a payment method';
            return;
        }

        const submitBtn = this.handle?.element?.querySelector('[data-action="submit"]');
        const cancelBtn = this.handle?.element?.querySelector('[data-action="cancel"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending request...';
        }

        this.state = 'submitting';

        try {
            const initResult = await this.opts.onConfirm({ phoneNumber, method });

            if (!initResult || initResult.error) {
                errorEl.textContent = initResult?.error || 'Failed to start payment';
                this.state = 'idle';
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Confirm Payment';
                }
                return;
            }

            const reference = initResult.reference;
            if (!reference) {
                // Payment may have completed synchronously (rare — wallet-funded
                // flow). Treat as success.
                this._showSuccess(initResult.data || initResult);
                return;
            }

            // Move to polling state
            this._showPollingStep();
            if (cancelBtn) cancelBtn.textContent = 'Cancel polling';

            this.state = 'polling';
            const result = await this.paymentsAPI.pollStatus(reference, {
                signal: this.abortController.signal,
                onUpdate: (status) => this._updatePollingStatus(status)
            });

            if (this.abortController.signal.aborted) {
                // User closed — don't show terminal state
                return;
            }

            if (result.terminal === 'completed') {
                this._showSuccess(result.data?.payment || result.data);
            } else if (result.terminal === 'timeout') {
                this._showFailure('Confirmation timed out. If you completed the payment on your phone, please check your transaction history in a few minutes.');
            } else {
                this._showFailure(result.error || 'Payment was not completed.');
            }
        } catch (err) {
            console.error('Payment flow error:', err);
            errorEl.textContent = 'Network error. Please try again.';
            this.state = 'idle';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirm Payment';
            }
        }
    }

    _showPollingStep() {
        const confirm = document.getElementById('pfm-step-confirm');
        const polling = document.getElementById('pfm-step-polling');
        if (confirm) confirm.hidden = true;
        if (polling) polling.hidden = false;

        // Hide the "Confirm Payment" button during polling
        const submitBtn = this.handle?.element?.querySelector('[data-action="submit"]');
        if (submitBtn) submitBtn.hidden = true;
    }

    _updatePollingStatus(status) {
        const statusEl = document.getElementById('pfm-poll-status');
        if (!statusEl || !status) return;
        const labels = {
            pending: 'Waiting for confirmation...',
            processing: 'Processing your payment...',
            authorized: 'Authorized — finalizing...'
        };
        statusEl.textContent = labels[status] || `Status: ${status}`;
    }

    _showSuccess(data) {
        this.state = 'success';
        document.getElementById('pfm-step-confirm').hidden = true;
        document.getElementById('pfm-step-polling').hidden = true;
        document.getElementById('pfm-step-failure').hidden = true;
        document.getElementById('pfm-step-success').hidden = false;

        const msg = document.getElementById('pfm-success-message');
        if (msg && data?.amount) {
            msg.textContent = `K${Number(data.amount).toFixed(2)} payment confirmed.`;
        }

        // Replace buttons
        if (this.handle?.element) {
            const footer = this.handle.element.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = '<button class="btn-primary" type="button" data-action="done">Done</button>';
                footer.querySelector('[data-action="done"]')?.addEventListener('click', () => {
                    this.handle?.close?.();
                });
            }
        }

        try {
            if (typeof this.opts.onSuccess === 'function') this.opts.onSuccess(data);
        } catch (err) {
            console.error('onSuccess callback error:', err);
        }
    }

    _showFailure(message) {
        this.state = 'failure';
        document.getElementById('pfm-step-confirm').hidden = true;
        document.getElementById('pfm-step-polling').hidden = true;
        document.getElementById('pfm-step-success').hidden = true;
        document.getElementById('pfm-step-failure').hidden = false;

        const msg = document.getElementById('pfm-failure-message');
        if (msg) msg.textContent = message || 'The transaction could not be completed.';

        if (this.handle?.element) {
            const footer = this.handle.element.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = '<button class="btn-secondary" type="button" data-action="close">Close</button>';
                footer.querySelector('[data-action="close"]')?.addEventListener('click', () => {
                    this.handle?.close?.();
                });
            }
        }

        try {
            if (typeof this.opts.onFailure === 'function') this.opts.onFailure({ message });
        } catch (err) {
            console.error('onFailure callback error:', err);
        }
    }

    _abort() {
        try { this.abortController.abort(); } catch {}
    }

    _isValidZambiaPhone(phone) {
        if (!phone) return false;
        const normalized = phone.replace(/\s|\-/g, '');
        return /^(\+?260|0)(9[567]|7[567])\d{7}$/.test(normalized);
    }

    _escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

window.PaymentFlowModal = PaymentFlowModal;
