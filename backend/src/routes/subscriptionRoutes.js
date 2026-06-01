import express from 'express';
import { 
  getSubscriptionPlans, subscribe, getMySubscription, 
  cancelSubscription, renewSubscription, getSubscriptionHistory, webhook
} from '../controllers/subscriptionController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/plans', getSubscriptionPlans);
router.post('/subscribe', auth, requireRole(['artist']), subscribe);
router.get('/my-subscription', auth, getMySubscription);
router.post('/cancel', auth, cancelSubscription);
router.post('/renew', auth, renewSubscription);
router.get('/history', auth, getSubscriptionHistory);
router.post('/webhook', webhook);

export default router;