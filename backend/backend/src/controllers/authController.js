import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Wallet from '../models/Wallet.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import emailService from '../services/emailService.js';

// Roles a client is allowed to self-assign at registration.
// 'admin', 'moderator', etc. can only be assigned by an existing admin,
// not via the public registration endpoint.
const SELF_REGISTERABLE_ROLES = ['listener', 'artist'];

// Pre-computed bcrypt hash of a random string. Used to equalise timing
// in `login` when the email doesn't exist. Without this, an attacker can
// time the response to learn which emails are registered.
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * Password policy in one place — used by register and updatePassword.
 * Returns null if valid, or an error string.
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

// ============================================================
// POST /api/auth/register
// ============================================================
export const register = async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        error: 'username, email, password, and fullName are required',
      });
    }

    // SECURITY: Allowlist roles. Old code accepted any role from the body,
    // letting clients POST {"role": "admin"} and become admins.
    const safeRole = SELF_REGISTERABLE_ROLES.includes(role) ? role : 'listener';

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      // SECURITY: Don't reveal whether email or username is taken.
      // Old code returned 'User already exists', enabling user enumeration.
      return res.status(400).json({
        error: 'Registration could not be completed. Please try a different email or username.',
      });
    }

    // Artists need to verify email before they can upload music.
    // Listeners are auto-verified.
    const needsVerification = safeRole === 'artist';

    const user = new User({
      username,
      email,
      password,
      fullName,
      role: safeRole,
      isVerified: !needsVerification,
    });

    if (needsVerification) {
      user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
    }

    await user.save();

    // Every user gets a wallet.
    await Wallet.create({ user: user._id });

    if (safeRole === 'artist') {
      await Artist.create({
        userId: user._id,
        stageName: username,
        subscriptionStatus: 'inactive',
        isEmailVerified: false,
      });

      const emailResult = await emailService.sendVerificationEmail(
        user.email,
        user.emailVerificationToken,
        username
      );
      if (!emailResult?.success) {
        console.error('Failed to send verification email to:', user.email);
        // We don't fail registration if email sending fails — the user can
        // request a resend. But we do log it for ops.
      }
    }

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const responseMessage = safeRole === 'artist'
      ? 'Registration successful. Please verify your email to start uploading music. A verification link has been sent to your inbox.'
      : 'Registration successful! Welcome to Bravo Music!';

    res.status(201).json({
      message: responseMessage,
      token,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// ============================================================
// POST /api/auth/login
// ============================================================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    // SECURITY: Equalise timing whether or not the email exists.
    // Always do a bcrypt compare so an attacker can't tell which emails
    // are registered by measuring response time.
    let isValidPassword = false;
    if (user) {
      isValidPassword = await user.comparePassword(password);
    } else {
      // Burn the equivalent CPU time on a dummy hash.
      await bcrypt.compare(password, DUMMY_HASH);
    }

    if (!user || !isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled. Contact support.' });
    }

    // Artists must verify email before logging in.
    if (user.role === 'artist' && !user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email first. Check your inbox for the verification link.',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// ============================================================
// GET /api/auth/verify-email/:token
// ============================================================
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired verification token. Please request a new verification email.',
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    if (user.role === 'artist') {
      await Artist.findOneAndUpdate(
        { userId: user._id },
        { isEmailVerified: true, verificationStatus: 'verified' }
      );
      await emailService.sendWelcomeEmail(user.email, user.username);
    }

    res.json({
      message: 'Email verified successfully! You can now upload music and access all artist features.',
    });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// ============================================================
// POST /api/auth/resend-verification
// ============================================================
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // SECURITY: Don't reveal whether the email exists. Always return the
    // same response. This is identical to the forgotPassword pattern.
    const genericResponse = {
      message: 'If an unverified artist account exists with that email, a new verification link has been sent.',
    };

    if (!user || user.role !== 'artist' || user.isVerified) {
      return res.json(genericResponse);
    }

    user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const emailResult = await emailService.sendVerificationEmail(
      user.email,
      user.emailVerificationToken,
      user.username
    );
    if (!emailResult?.success) {
      console.error('Failed to resend verification email to:', user.email);
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification' });
  }
};

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });

    // SECURITY: Always return the same response (already correct in the
    // original code — preserved here).
    const genericResponse = {
      message: 'If an account exists with that email, you will receive a password reset link.',
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const emailResult = await emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.username
    );
    if (!emailResult?.success) {
      console.error('Failed to send password reset email to:', user.email);
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
};

// ============================================================
// POST /api/auth/reset-password/:token
// ============================================================
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token. Please request a new password reset.',
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await emailService.sendPasswordChangeConfirmation(user.email, user.username);

    res.json({
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
};

// ============================================================
// PUT /api/auth/password
// ============================================================
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    user.password = newPassword;
    await user.save();

    await emailService.sendPasswordChangeConfirmation(user.email, user.username);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

// ============================================================
// POST /api/auth/refresh
// ============================================================
// Renamed the request body field to `token` to avoid shadowing the
// exported function name `refreshToken` below.
export const refresh = async (req, res) => {
  try {
    const incomingToken = req.body.refreshToken || req.body.token;
    if (!incomingToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = verifyRefreshToken(incomingToken);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Sanity: user must still exist and be active.
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// Backwards-compat alias — keep the old export name so existing routes work.
export const refreshToken = refresh;

// ============================================================
// POST /api/auth/logout
// ============================================================
// TODO: Implement proper token revocation using a Redis blocklist.
//   On logout, add the JWT's `jti` claim (or hash of the token) to Redis
//   with TTL = remaining token lifetime. Update auth middleware to reject
//   any token whose jti is in the blocklist.
//   Currently logout is a client-side delete only — the token remains
//   valid until expiry. For short-lived tokens (15-30 min) this is usually
//   acceptable. For long-lived (7d+) tokens, server-side revocation matters.
export const logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};
