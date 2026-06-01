import express from 'express';
import { 
  getPromotionPackages, purchasePromotion, getMyPromotions, 
  getFeaturedContent, cancelPromotion
} from '../controllers/promotionController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/packages', getPromotionPackages);
router.post('/purchase', auth, requireRole(['artist']), purchasePromotion);
router.get('/my-promotions', auth, requireRole(['artist']), getMyPromotions);
router.get('/featured', getFeaturedContent);
router.post('/:promotionId/cancel', auth, requireRole(['artist']), cancelPromotion);

export default router;