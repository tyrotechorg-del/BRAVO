import express from 'express';
import {
  getPromotionPackages,
  purchasePromotion,
  getMyPromotions,
  getFeaturedContent,
  cancelPromotion,
} from '../controllers/promotionController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/packages', getPromotionPackages);
router.get('/featured', getFeaturedContent);

router.post('/purchase', auth, requireRole(['artist']), purchasePromotion);
router.get('/my-promotions', auth, requireRole(['artist']), getMyPromotions);

// FIX: Was `requireRole(['artist'])` — admins couldn't cancel promotions
// (for moderation or refund cases). Our fixed controller accepts both
// the owning artist AND any admin; the route now matches.
router.post('/:promotionId/cancel', auth, requireRole(['artist', 'admin']), cancelPromotion);

export default router;
