import crypto from 'crypto';

/**
 * Webhook signature verification.
 *
 * FIX: The original used `JSON.stringify(req.body)` to compute the
 * expected signature, but `express.json()` has already parsed and
 * discarded the original byte stream by the time middleware runs.
 * Re-stringifying produces output that may differ from what the
 * sender signed (key ordering, whitespace, escape conventions all
 * vary between JSON serializers). The signature check would
 * intermittently or always fail in production.
 *
 * The fix: server.js now captures the raw body during JSON parsing
 * via `express.json({ verify: ... })` and exposes it as `req.rawBody`.
 * This middleware uses that raw buffer for signature verification.
 *
 * FIX: The original used `Buffer.from(signature)` and `Buffer.from(expectedSignature)`
 * for `timingSafeEqual` without ensuring equal length. If lengths
 * differ, timingSafeEqual throws (in newer Node) or returns false in
 * unpredictable time (older Node). We check length first.
 */
export const verifyWebhook = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('WEBHOOK_SECRET not configured in production');
      return res.status(500).json({ error: 'Webhook verification not configured' });
    }
    // Dev mode: skip verification so local testing isn't blocked.
    return next();
  }

  // Replay-window check: reject webhooks older than 5 minutes. Without
  // this, an attacker who once captured a valid signed payload could
  // replay it indefinitely.
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
    return res.status(401).json({ error: 'Webhook timestamp invalid or expired' });
  }

  // Use the captured raw body — see server.js verify hook.
  const payload = req.rawBody !== undefined ? req.rawBody : JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  // Length check before timingSafeEqual.
  if (signature.length !== expectedSignature.length) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
};

/**
 * Module-scope dedup cache.
 *
 * FIX: The original code defined `webhookCache` INSIDE the middleware
 * function, meaning every request created a new empty Map. The dedup
 * check `if (webhookCache.has(webhookId))` was always false. The whole
 * "duplicate webhook protection" feature did nothing.
 *
 * Now scoped at module level so the cache persists across requests.
 * Entries auto-expire after 24h via setTimeout.
 *
 * Note: this is in-memory only. In a multi-instance deployment, dedup
 * needs Redis or a database flag (e.g., on Payment.metadata) — flagged
 * for future work. The Payment-level idempotency check in the
 * paymentController (`if (payment.status !== 'pending')`) is the
 * stronger guarantee; this Map is belt-and-suspenders.
 */
const webhookDedupCache = new Map();

export const rateLimitWebhook = (req, res, next) => {
  const webhookId = req.headers['x-webhook-id'];
  if (!webhookId) {
    // No webhook ID header — can't dedup, but don't block (the provider
    // may not send this header). The Payment-level idempotency check is
    // the real protection.
    return next();
  }

  if (webhookDedupCache.has(webhookId)) {
    return res.status(429).json({ error: 'Duplicate webhook' });
  }

  webhookDedupCache.set(webhookId, Date.now());
  setTimeout(() => webhookDedupCache.delete(webhookId), 24 * 60 * 60 * 1000).unref();

  next();
};

export const logWebhook = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      type: 'webhook',
      provider: req.params.provider,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
};

export default { verifyWebhook, rateLimitWebhook, logWebhook };
