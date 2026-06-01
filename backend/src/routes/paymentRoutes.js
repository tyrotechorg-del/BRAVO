import express from 'express';
import { 
    initiatePayment, 
    paymentCallback, 
    getPaymentStatus, 
    getPaymentHistory, 
    refundPayment, 
    getPaymentMethods,
    initiateMobileMoneyPayment,
    handlePawaPayWebhook
} from '../controllers/paymentController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/methods', getPaymentMethods);

// Protected routes
router.post('/initiate', auth, initiatePayment);
router.post('/mobile-money', auth, initiateMobileMoneyPayment);
router.get('/status/:reference', auth, getPaymentStatus);
router.get('/history', auth, getPaymentHistory);
router.post('/refund/:paymentId', auth, requireRole(['admin']), refundPayment);

// Webhook routes (no auth - called by payment provider)
router.post('/callback/:provider', paymentCallback);
router.post('/pawapay-webhook', handlePawaPayWebhook);

export default router;