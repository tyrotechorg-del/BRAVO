import axios from 'axios';
import crypto from 'crypto';

class PawaPayService {
  constructor() {
    this.apiKey = process.env.PAWAPAY_API_KEY;
    this.secretKey = process.env.PAWAPAY_SECRET_KEY;
    this.baseUrl =
      process.env.PAWAPAY_ENV === 'production'
        ? 'https://api.pawapay.io/v1'
        : 'https://sandbox.pawapay.io/v1';

    this.providers = {
      mtn: 'MTN_ZAMBIA',
      airtel: 'AIRTEL_ZAMBIA',
      zamtel: 'ZAMTEL_ZAMBIA',
    };

    // Don't crash on import if env vars are missing — the methods that
    // actually need them will check and throw. Some deployments use
    // paymentService in dev mode without PawaPay configured.
    this.configured = Boolean(this.apiKey && this.secretKey);
  }

  /**
   * Throw a helpful error if PawaPay isn't configured. Called by every
   * outbound method so dev environments without PawaPay still load the
   * module but get a clear error when they try to actually use it.
   */
  ensureConfigured() {
    if (!this.configured) {
      throw new Error(
        'PawaPay is not configured. Set PAWAPAY_API_KEY and PAWAPAY_SECRET_KEY env vars.'
      );
    }
  }

  getHeaders() {
    this.ensureConfigured();
    const timestamp = Date.now();
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${timestamp}${this.apiKey}`)
      .digest('hex');

    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'Content-Type': 'application/json',
    };
  }

  async initiatePayment(phoneNumber, amount, reference, provider = 'mtn') {
    try {
      this.ensureConfigured();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const providerCode = this.providers[provider];

      if (!providerCode) {
        return { success: false, error: `Unknown provider: ${provider}` };
      }

      const payload = {
        amount: { currency: 'ZMW', value: amount },
        payer: {
          type: 'CONSUMER',
          address: formattedPhone,
          providerCode,
        },
        payee: {
          type: 'MERCHANT',
          reference: process.env.PAWAPAY_MERCHANT_ID,
        },
        reference,
        description: `Bravo Music - Payment for ${reference}`,
        callbackUrl: `${process.env.API_URL}/api/payments/pawapay-webhook`,
        expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };

      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: this.getHeaders(),
        timeout: 30_000, // 30s — was unbounded. A slow PawaPay would hang the request.
      });

      return {
        success: true,
        transactionId: response.data.id,
        status: response.data.status,
        paymentUrl: response.data._links?.checkout?.href,
        requiresRedirect: response.data.requiresRedirect || false,
      };
    } catch (error) {
      console.error('PawaPay initiation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Payment initiation failed',
      };
    }
  }

  async checkPaymentStatus(transactionId) {
    try {
      this.ensureConfigured();
      const response = await axios.get(`${this.baseUrl}/payments/${transactionId}`, {
        headers: this.getHeaders(),
        timeout: 30_000,
      });

      const statusMap = {
        COMPLETED: 'completed',
        PENDING: 'pending',
        FAILED: 'failed',
        EXPIRED: 'failed',
        CANCELLED: 'failed',
      };

      return {
        success: true,
        status: statusMap[response.data.status] || 'pending',
        transaction: response.data,
        amount: response.data.amount?.value,
        phoneNumber: response.data.payer?.address,
      };
    } catch (error) {
      console.error('Status check error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async initiateWithdrawal(phoneNumber, amount, reference, provider = 'mtn') {
    try {
      this.ensureConfigured();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const providerCode = this.providers[provider];

      if (!providerCode) {
        return { success: false, error: `Unknown provider: ${provider}` };
      }

      const payload = {
        amount: { currency: 'ZMW', value: amount },
        payee: {
          type: 'CONSUMER',
          address: formattedPhone,
          providerCode,
        },
        payer: {
          type: 'MERCHANT',
          reference: process.env.PAWAPAY_MERCHANT_ID,
        },
        reference,
        description: `Bravo Music - Withdrawal for ${reference}`,
        callbackUrl: `${process.env.API_URL}/api/payments/withdrawal-callback`,
      };

      const response = await axios.post(`${this.baseUrl}/payouts`, payload, {
        headers: this.getHeaders(),
        timeout: 30_000,
      });

      return {
        success: true,
        transactionId: response.data.id,
        status: response.data.status,
      };
    } catch (error) {
      console.error('Withdrawal error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Withdrawal failed',
      };
    }
  }

  async getBalance() {
    try {
      this.ensureConfigured();
      const response = await axios.get(`${this.baseUrl}/balances`, {
        headers: this.getHeaders(),
        timeout: 30_000,
      });
      return { success: true, balances: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  formatPhoneNumber(phoneNumber) {
    let cleaned = String(phoneNumber || '').replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '260' + cleaned.substring(1);
    } else if (!cleaned.startsWith('260')) {
      cleaned = '260' + cleaned;
    }
    return cleaned;
  }

  /**
   * Verify a PawaPay webhook signature against a raw body buffer.
   *
   * SECURITY FIXES from the original:
   *   1. The original used `signature !== expectedSignature` — a
   *      non-constant-time string comparison that leaks signature bits
   *      via timing. Now uses `crypto.timingSafeEqual`.
   *   2. The original passed `JSON.stringify(payload)` to HMAC. By the
   *      time this function ran, Express had parsed and re-serialized
   *      the body — the re-serialized bytes don't reliably match what
   *      the sender signed. We now accept the raw body string captured
   *      by server.js's `express.json({ verify: ... })` hook.
   *
   * The caller should pass `req.rawBody` (a string), not `req.body`.
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!this.secretKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('PawaPay secret key not configured in production');
        return false;
      }
      return true; // dev mode — allow unsigned for local testing
    }

    if (!signature || typeof signature !== 'string') return false;

    const body =
      typeof rawBody === 'string'
        ? rawBody
        : Buffer.isBuffer(rawBody)
        ? rawBody.toString('utf8')
        : JSON.stringify(rawBody); // fallback (lossy — flagged above)

    const expected = crypto
      .createHmac('sha256', this.secretKey)
      .update(body)
      .digest('hex');

    if (signature.length !== expected.length) return false;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse a webhook payload after the signature has been verified.
   * Returns a normalized event description.
   */
  parseWebhookEvent(payload) {
    const eventType = payload?.event;
    const transactionId = payload?.data?.id;

    switch (eventType) {
      case 'payment.completed':
        return {
          type: 'payment',
          status: 'completed',
          transactionId,
          amount: payload.data.amount?.value,
          reference: payload.data.reference,
        };
      case 'payment.failed':
        return {
          type: 'payment',
          status: 'failed',
          transactionId,
          reference: payload.data.reference,
        };
      case 'payout.completed':
        return {
          type: 'withdrawal',
          status: 'completed',
          transactionId,
          reference: payload.data.reference,
        };
      case 'payout.failed':
        return {
          type: 'withdrawal',
          status: 'failed',
          transactionId,
          reference: payload.data.reference,
        };
      default:
        return { type: 'unknown', status: 'ignored', eventType };
    }
  }

  /**
   * Legacy `handleWebhook` API — kept for backwards compatibility with
   * any caller using it. Internally splits into verify + parse.
   */
  async handleWebhook(payload, signature, rawBody) {
    const body = rawBody || JSON.stringify(payload);
    if (!this.verifyWebhookSignature(body, signature)) {
      throw new Error('Invalid webhook signature');
    }
    return this.parseWebhookEvent(payload);
  }
}

export default new PawaPayService();
