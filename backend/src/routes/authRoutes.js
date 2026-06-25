import express from 'express';
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  resendVerification,
  updatePassword,
  getMe,
} from '../controllers/authController.js';
import { authLimiter, passwordLimiter } from '../middleware/rateLimiter.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh-token', authLimiter, refreshToken);

router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);

// FIX: Added passwordLimiter on reset endpoints. Without it, an attacker
// could brute-force reset tokens (32 bytes hex = 256 bits, infeasible in
// theory but a rate limit costs nothing and stops accidental traffic
// from looking like an attack).
router.post('/forgot-password', passwordLimiter, forgotPassword);
router.post('/reset-password/:token', passwordLimiter, resetPassword);
router.post('/update-password', auth, passwordLimiter, updatePassword);

router.post('/logout', logout);

// Current authenticated user (session re-hydration)
router.get('/me', auth, getMe);

export default router;
