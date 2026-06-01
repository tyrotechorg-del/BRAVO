import express from 'express';
import { getBalance, getTransactions, deposit, withdraw, getEarnings } from '../controllers/walletController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/balance', auth, getBalance);
router.get('/transactions', auth, getTransactions);
router.post('/deposit', auth, deposit);
router.post('/withdraw', auth, requireRole(['artist']), withdraw);
router.get('/earnings', auth, requireRole(['artist']), getEarnings);

export default router;