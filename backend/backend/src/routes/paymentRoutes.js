import express from 'express';
import {
  initiatePayment,
  paymentCallback,
  getPaymentStatus,
  getPaymentHistory,
  refundPayment,
  getPaymentMethods,
  initiateMobileMoneyPayment,
  handlePawaPayWebhook,
} from '../controllers/paymentController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public
router.get('/methods', getPaymentMethods);

// Protected
router.post('/initiate', auth, initiatePayment);
router.post('/mobile-money', auth, initiateMobileMoneyPayment);
router.get('/status/:reference', auth, getPaymentStatus);
router.get('/history', auth, getPaymentHistory);
router.post('/refund/:paymentId', auth, requireRole(['admin']), refundPayment);

// ============================================================
// Webhook routes (called by payment provider — no auth)
// ============================================================
//
// IMPORTANT: Signature verification inside these controllers reads
// `req.rawBody` (captured by the `verify` hook in express.json()
// — see server.js). If you remove the verify hook, signature
// verification will fall back to JSON.stringify(req.body) which may
// not match the bytes the sender signed and the verification will
// fail for legitimate webhooks.
//
// These routes are intentionally outside any authLimiter — payment
// providers may retry rapidly. The controllers handle idempotency
// (`if (payment.status !== 'pending') return alreadyProcessed`).
//
router.post('/callback/:provider', paymentCallback);
router.post('/pawapay-webhook', handlePawaPayWebhook);

export default router;
