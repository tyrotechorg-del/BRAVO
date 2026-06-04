import express from 'express';
import { register, login, verifyEmail, forgotPassword, resetPassword, refreshToken, logout, resendVerification, updatePassword } from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/update-password', auth, updatePassword);

export default router;