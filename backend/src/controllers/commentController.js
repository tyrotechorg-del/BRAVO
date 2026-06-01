import Comment from '../models/Comment.js';
import Song from '../models/Song.js';
import Notification from '../models/Notification.js';
import Report from '../models/Report.js';
import { getIO } from '../config/socket.js';

export const addComment = async (req, res) => {
    try {
        const { songId, content, parentCommentId } = req.body;
        
        const song = await Song.findById(songId).populate('artist');
        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        const comment = new Comment({
            user: req.user._id,
            song: songId,
            content,
            parentComment: parentCommentId || null
        });

        await comment.save();

        song.commentCount++;
        await song.save();

        if (parentCommentId) {
            const parentComment = await Comment.findById(parentCommentId);
            if (parentComment) {
                parentComment.replies.push(comment._id);
                await parentComment.save();
                
                if (parentComment.user.toString() !== req.user._id.toString()) {
                    const notification = new Notification({
                        user: parentComment.user,
                        type: 'comment',
                        title: 'New Reply',
                        message: `${req.user.username} replied to your comment on "${song.title}"`,
                        data: { songId, commentId: comment._id }
                    });
                    await notification.save();
                    
                    const io = getIO();
                    io.to(`user:${parentComment.user}`).emit('notification', notification);
                }
            }
        } else {
            if (song.artist.userId.toString() !== req.user._id.toString()) {
                const notification = new Notification({
                    user: song.artist.userId,
                    type: 'comment',
                    title: 'New Comment',
                    message: `${req.user.username} commented on your song "${song.title}"`,
                    data: { songId, commentId: comment._id }
                });
                await notification.save();
                
                const io = getIO();
                io.to(`user:${song.artist.userId}`).emit('notification', notification);
            }
        }

        await comment.populate('user', 'username avatar');

        res.status(201).json({
            message: 'Comment added',
            comment
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
};

export const getSongComments = async (req, res) => {
    try {
        const { songId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const comments = await Comment.find({ 
            song: songId, 
            parentComment: null,
            isDeleted: false
        })
        .populate('user', 'username avatar')
        .populate({
            path: 'replies',
            match: { isDeleted: false },
            populate: { path: 'user', select: 'username avatar' }
        })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        const total = await Comment.countDocuments({ song: songId, parentComment: null });

        res.json({
            comments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
};

export const likeComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const likeIndex = comment.likes.indexOf(req.user._id);
        
        if (likeIndex > -1) {
            comment.likes.splice(likeIndex, 1);
            await comment.save();
            res.json({ message: 'Comment unliked', liked: false });
        } else {
            comment.likes.push(req.user._id);
            await comment.save();
            
            if (comment.user.toString() !== req.user._id.toString()) {
                const notification = new Notification({
                    user: comment.user,
                    type: 'like',
                    title: 'Comment Liked',
                    message: `${req.user.username} liked your comment`,
                    data: { commentId: comment._id }
                });
                await notification.save();
                
                const io = getIO();
                io.to(`user:${comment.user}`).emit('notification', notification);
            }
            
            res.json({ message: 'Comment liked', liked: true });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to like comment' });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.commentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        comment.isDeleted = true;
        await comment.save();

        const song = await Song.findById(comment.song);
        if (song) {
            song.commentCount--;
            await song.save();
        }

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete comment' });
    }
};

export const reportComment = async (req, res) => {
    try {
        const { reason } = req.body;
        const comment = await Comment.findById(req.params.commentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        comment.isFlagged = true;
        comment.flaggedAt = new Date();
        comment.flaggedReason = reason;
        await comment.save();

        const report = new Report({
            reporter: req.user._id,
            type: 'comment',
            contentId: comment._id,
            reason,
            status: 'pending'
        });
        await report.save();

        res.json({ message: 'Comment reported' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to report comment' });
    }
};