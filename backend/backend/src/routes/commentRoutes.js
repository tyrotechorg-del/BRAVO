import express from 'express';
import {
  addComment,
  getSongComments,
  likeComment,
  deleteComment,
  reportComment,
} from '../controllers/commentController.js';
import { auth } from '../middleware/auth.js';
import { commentLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// FIX: addComment rate-limited per user (20/min). Without this, a
// single user could spam unlimited comments — and we already added
// length validation in the controller, but length validation doesn't
// help if you can post 1000 comments per second.
router.post('/', auth, commentLimiter, addComment);

router.get('/song/:songId', getSongComments);
router.post('/:commentId/like', auth, likeComment);
router.delete('/:commentId', auth, deleteComment);

// Report uses the same rate limiter — preventing report-spam (which
// could be used to harass a target by flagging all their comments).
router.post('/:commentId/report', auth, commentLimiter, reportComment);

export default router;
