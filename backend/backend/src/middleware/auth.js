import { verifyToken } from '../config/jwt.js';
import User from '../models/User.js';

/**
 * Verify the bearer token, load the user, attach to req.user.
 * Returns 401 if anything is wrong.
 */
export const auth = async (req, res, next) => {
  try {
    const header = req.header('Authorization');
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Please authenticate' });
    }
    const token = header.slice(7); // 'Bearer '.length === 7

    if (!token) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    // Don't leak the actual error — could reveal whether a user exists
    return res.status(401).json({ error: 'Please authenticate' });
  }
};

/**
 * Restrict to one or more roles. Must be used AFTER auth().
 *
 *   router.delete('/songs/:id', auth, requireRole(['admin', 'moderator']), handler)
 *
 * The req.user check is a safety net in case requireRole is accidentally
 * placed before auth() — the old version would crash the process with
 * "Cannot read property 'role' of undefined".
 */
export const requireRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

/**
 * Like `auth`, but doesn't reject anonymous requests.
 *
 * If a valid bearer token is present, attaches `req.user`. If no token
 * (or an invalid token) is present, `req.user` is left undefined and the
 * request proceeds anyway. The controller is responsible for handling
 * both cases.
 *
 * Use this on endpoints that are public-by-default but offer extra
 * behaviour for logged-in users (e.g. download history is tied to a
 * user, but downloading a non-premium song works for guests too).
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const header = req.header('Authorization');
    if (!header || !header.startsWith('Bearer ')) {
      // No token — proceed as guest.
      return next();
    }

    const token = header.slice(7);
    if (!token) return next();

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      // Bad token — treat as guest rather than rejecting. This is the key
      // difference from `auth`: we never 401 here. Endpoints that need
      // strict auth should use `auth`, not `optionalAuth`.
      return next();
    }

    const user = await User.findById(decoded.userId);
    if (user && user.isActive) {
      req.user = user;
      req.token = token;
    }
    next();
  } catch (err) {
    // Any error → proceed as guest. Don't leak whether the token was
    // structurally valid by varying response time/behaviour.
    next();
  }
};

/**
 * Require email-verified user. Must be used AFTER auth().
 *
 * Note: not async — there's no I/O. The original was marked async, which
 * wrapped its return value in a Promise and changed how Express handles
 * uncaught errors in the middleware chain.
 */
export const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!req.user.isVerified) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  next();
};
