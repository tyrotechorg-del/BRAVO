import express from 'express';
import { addComment, getSongComments, likeComment, deleteComment, reportComment } from '../controllers/commentController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, addComment);
router.get('/song/:songId', getSongComments);
router.post('/:commentId/like', auth, likeComment);
router.delete('/:commentId', auth, deleteComment);
router.post('/:commentId/report', auth, reportComment);

export default router;