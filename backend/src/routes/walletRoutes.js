import express from 'express';
import {
  getBalance,
  getTransactions,
  deposit,
  withdraw,
  getEarnings,
} from '../controllers/walletController.js';
import { auth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/balance', auth, getBalance);
router.get('/transactions', auth, getTransactions);
router.post('/deposit', auth, deposit);

// Withdrawals and earnings are artist-only. The withdraw race condition
// from batch 1 is fixed in the controller — atomic balance check + debit.
router.post('/withdraw', auth, requireRole(['artist']), withdraw);
router.get('/earnings', auth, requireRole(['artist']), getEarnings);

export default router;
