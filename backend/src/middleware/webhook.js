import crypto from 'crypto';

export const verifyWebhook = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return res.status(401).json({ error: 'Webhook timestamp expired' });
  }
  
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  
  next();
};

export const rateLimitWebhook = (req, res, next) => {
  const webhookId = req.headers['x-webhook-id'];
  const webhookCache = new Map();
  
  if (webhookCache.has(webhookId)) {
    return res.status(429).json({ error: 'Duplicate webhook' });
  }
  
  webhookCache.set(webhookId, Date.now());
  
  setTimeout(() => {
    webhookCache.delete(webhookId);
  }, 24 * 60 * 60 * 1000);
  
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
      ip: req.ip
    });
  });
  
  next();
};

export default { verifyWebhook, rateLimitWebhook, logWebhook };