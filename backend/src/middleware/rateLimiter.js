import rateLimit from 'express-rate-limit';

// ============================================================
// General per-IP limiter
// ============================================================
// Mounted globally in server.js on `/api/`. Most endpoints inherit this.
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Authentication
// ============================================================
// Tight limit for login, register, refresh — these are brute-force targets.
// Successful requests don't count (skipSuccessfulRequests) so a legitimate
// user who logs in once doesn't lose budget for the next 15 min.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// FIX: New limiter for password reset / change endpoints. Same threat
// model as authLimiter but failures must count too (an attacker
// guessing reset tokens always "fails" but the attempts are the attack).
export const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many password-related requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Uploads
// ============================================================
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Upload limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Comments
// ============================================================
// FIX (new): per-user comment limit. Without this, a single user can
// spam unlimited comments. 20/min is generous for legitimate use; spam
// bots will hit it instantly.
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { error: 'You are commenting too quickly. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Search
// ============================================================
// FIX (new): Search is regex-driven (controller has ReDoS protection
// but still scans collections). Without a limiter, an attacker can
// run ~100 searches/sec from one IP and starve the DB.
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 1 query/sec — plenty for autocomplete + real search
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { error: 'Too many search requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Downloads (split by user vs guest — see downloadRoutes.js)
// ============================================================
// Defined inline in downloadRoutes.js because the keyGenerator and
// skip() depend on req.user which only exists after optionalAuth runs.
// Kept the limiter definitions co-located with the routes that use them.

export default {
  limiter,
  authLimiter,
  passwordLimiter,
  uploadLimiter,
  commentLimiter,
  searchLimiter,
};
