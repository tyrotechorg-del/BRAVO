import express from 'express';
import {
  getSubscriptionPlans,
  subscribe,
  getMySubscription,
  cancelSubscription,
  renewSubscription,
  getSubscriptionHistory,
  webhook,
} from '../controllers/subscriptionController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/plans', getSubscriptionPlans);

router.post('/subscribe', auth, requireRole(['artist']), subscribe);
router.get('/my-subscription', auth, getMySubscription);
router.post('/cancel', auth, cancelSubscription);

// renewSubscription now requires payment (see batch 4 — was a money bug).
// The endpoint returns a payment URL, not a confirmation.
router.post('/renew', auth, renewSubscription);

router.get('/history', auth, getSubscriptionHistory);

// Webhook — no auth, signature-verified inside the controller against
// req.rawBody (captured by express.json's verify hook in server.js).
router.post('/webhook', webhook);

export default router;
