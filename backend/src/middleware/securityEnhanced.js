import crypto from 'crypto';
import redisClient from '../config/redis.js';
import User from '../models/User.js';
import AdminLog from '../models/AdminLog.js';

// Rate limiting per user
export const perUserRateLimiter = (maxRequests = 100, windowMs = 60000) => {
    return async (req, res, next) => {
        const userId = req.user?._id || req.ip;
        const key = `rate_limit:${userId}:${req.path}`;
        
        try {
            const redis = await redisClient.getRedis();
            const current = await redis.incr(key);
            
            if (current === 1) {
                await redis.expire(key, windowMs / 1000);
            }
            
            if (current > maxRequests) {
                // Log suspicious activity
                await AdminLog.create({
                    admin: req.user?._id,
                    action: 'rate_limit_exceeded',
                    details: { path: req.path, ip: req.ip, count: current },
                    timestamp: new Date()
                });
                
                return res.status(429).json({ 
                    error: 'Too many requests', 
                    retryAfter: Math.ceil(windowMs / 1000) 
                });
            }
            
            next();
        } catch (error) {
            console.error('Rate limiter error:', error);
            next();
        }
    };
};

// Device fingerprinting
export const deviceFingerprint = () => {
    return (req, res, next) => {
        const fingerprint = crypto
            .createHash('sha256')
            .update([
                req.headers['user-agent'],
                req.headers['accept-language'],
                req.headers['sec-ch-ua'],
                req.ip
            ].join('|'))
            .digest('hex');
        
        req.deviceFingerprint = fingerprint;
        next();
    };
};

// Suspicious activity detection
export const detectSuspiciousActivity = () => {
    return async (req, res, next) => {
        if (!req.user) return next();
        
        const suspiciousPatterns = [];
        
        // Check for multiple failed logins
        const failedLogins = await AdminLog.countDocuments({
            target: req.user._id,
            action: 'failed_login',
            timestamp: { $gt: new Date(Date.now() - 15 * 60 * 1000) }
        });
        
        if (failedLogins > 5) {
            suspiciousPatterns.push('multiple_failed_logins');
        }
        
        // Check for unusual location
        const lastLogin = await AdminLog.findOne({
            target: req.user._id,
            action: 'login'
        }).sort({ timestamp: -1 });
        
        if (lastLogin && lastLogin.details?.ip !== req.ip) {
            suspiciousPatterns.push('ip_change');
            
            // Send alert email
            if (req.user.email) {
                await import('../services/emailService.js').then(module => {
                    module.default.sendEmail(
                        req.user.email,
                        'Suspicious Login Detected',
                        `New login from ${req.ip}. If this wasn't you, please reset your password.`
                    );
                });
            }
        }
        
        if (suspiciousPatterns.length > 0) {
            req.suspicious = suspiciousPatterns;
            await AdminLog.create({
                admin: req.user._id,
                action: 'suspicious_activity',
                details: { patterns: suspiciousPatterns, ip: req.ip },
                timestamp: new Date()
            });
        }
        
        next();
    };
};

// 2FA Middleware
export const requireTwoFactor = () => {
    return async (req, res, next) => {
        if (req.user.role === 'admin' || req.user.role === 'artist') {
            const user = await User.findById(req.user._id);
            
            if (user.twoFactorEnabled && !req.headers['x-2fa-code']) {
                return res.status(401).json({ 
                    error: '2FA required',
                    requireTwoFactor: true 
                });
            }
            
            if (user.twoFactorEnabled && req.headers['x-2fa-code']) {
                const isValid = verifyTwoFactorCode(user.twoFactorSecret, req.headers['x-2fa-code']);
                if (!isValid) {
                    return res.status(401).json({ error: 'Invalid 2FA code' });
                }
            }
        }
        
        next();
    };
};

// Generate 2FA secret
export const generateTwoFactorSecret = () => {
    const secret = crypto.randomBytes(20).toString('hex');
    return secret;
};

// Verify 2FA code
export const verifyTwoFactorCode = (secret, code) => {
    // Simple TOTP implementation
    const epoch = Math.floor(Date.now() / 1000 / 30);
    const hash = crypto
        .createHmac('sha1', secret)
        .update(epoch.toString())
        .digest('hex');
    
    const offset = parseInt(hash.slice(-1), 16);
    const truncated = parseInt(hash.slice(offset * 2, offset * 2 + 8), 16) & 0x7fffffff;
    const expectedCode = (truncated % 1000000).toString().padStart(6, '0');
    
    return code === expectedCode;
};

// JWT refresh token rotation
export const rotateRefreshToken = async (req, res, next) => {
    const oldToken = req.body.refreshToken;
    
    if (!oldToken) return next();
    
    try {
        const decoded = jwt.verify(oldToken, process.env.JWT_REFRESH_SECRET);
        
        // Check if token has been used before (replay attack)
        const usedToken = await redisClient.getRedis().then(redis => 
            redis.get(`used_token:${oldToken}`)
        );
        
        if (usedToken) {
            // Token replay detected - possible compromise
            await User.findByIdAndUpdate(decoded.userId, { isActive: false });
            return res.status(401).json({ error: 'Token reuse detected. Account suspended.' });
        }
        
        // Mark token as used
        await redisClient.getRedis().then(redis => 
            redis.setex(`used_token:${oldToken}`, 3600, 'used')
        );
        
        next();
    } catch (error) {
        next();
    }
};

// Signed URLs for content protection
export const generateSignedUrl = (filePath, expiresIn = 900) => {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = crypto
        .createHmac('sha256', process.env.URL_SIGNING_SECRET)
        .update(`${filePath}:${expires}`)
        .digest('hex');
    
    return `/api/protected/stream?path=${encodeURIComponent(filePath)}&expires=${expires}&signature=${signature}`;
};

export const verifySignedUrl = (req, res, next) => {
    const { path: filePath, expires, signature } = req.query;
    
    if (!filePath || !expires || !signature) {
        return res.status(401).json({ error: 'Invalid request' });
    }
    
    // Check expiration
    if (Date.now() / 1000 > parseInt(expires)) {
        return res.status(401).json({ error: 'URL expired' });
    }
    
    // Verify signature
    const expectedSignature = crypto
        .createHmac('sha256', process.env.URL_SIGNING_SECRET)
        .update(`${filePath}:${expires}`)
        .digest('hex');
    
    if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    req.filePath = filePath;
    next();
};

// GDPR compliance
export const exportUserData = async (userId) => {
    const user = await User.findById(userId).select('-password');
    const wallet = await Wallet.findOne({ user: userId });
    const transactions = await Transaction.find({ user: userId });
    const playlists = await Playlist.find({ user: userId });
    const likes = await Like.find({ user: userId });
    const comments = await Comment.find({ user: userId });
    
    const exportData = {
        user,
        wallet,
        transactions,
        playlists,
        likes,
        comments,
        exportDate: new Date().toISOString()
    };
    
    return exportData;
};

export const deleteUserData = async (userId) => {
    // Anonymize user data instead of hard delete for compliance
    await User.findByIdAndUpdate(userId, {
        email: `deleted_${userId}@deleted.com`,
        username: `deleted_user_${userId}`,
        fullName: 'Deleted User',
        isActive: false,
        password: crypto.randomBytes(32).toString('hex'),
        $unset: {
            avatar: 1,
            bio: 1,
            socialLinks: 1,
            location: 1
        }
    });
    
    // Keep transaction records for legal requirements but anonymize
    await Transaction.updateMany(
        { user: userId },
        { $set: { user: null, anonymized: true } }
    );
    
    return { success: true, message: 'User data anonymized' };
};