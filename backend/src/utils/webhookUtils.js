const crypto = require('crypto');

const verifyWebhookSignature = (payload, signature, secret) => {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
};

const generateWebhookPayload = (event, data) => {
    return {
        id: generateWebhookId(),
        event,
        data,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
};

const generateWebhookId = () => {
    return `wh_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

const retryWebhook = async (url, payload, maxRetries = 3, delay = 1000) => {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': generateWebhookSignature(payload)
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                return { success: true, attempt: i + 1 };
            }
            
            lastError = await response.text();
        } catch (error) {
            lastError = error.message;
        }
        
        if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
    
    return { success: false, error: lastError };
};

module.exports = {
    verifyWebhookSignature,
    generateWebhookPayload,
    generateWebhookId,
    retryWebhook
};