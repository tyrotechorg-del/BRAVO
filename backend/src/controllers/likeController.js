import Like from '../models/Like.js';
import Song from '../models/Song.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import { getIO } from '../config/socket.js';

export const toggleLike = async (req, res) => {
    try {
        const { type, targetId } = req.body;
        
        let existingLike = await Like.findOne({
            user: req.user._id,
            type: type,
            [type === 'song' ? 'song' : 'comment']: targetId
        });
        
        if (existingLike) {
            await existingLike.deleteOne();
            
            if (type === 'song') {
                await Song.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } });
            } else if (type === 'comment') {
                await Comment.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } });
            }
            
            return res.json({ liked: false, message: 'Like removed' });
        }
        
        const like = new Like({
            user: req.user._id,
            type: type,
            [type === 'song' ? 'song' : 'comment']: targetId
        });
        
        await like.save();
        
        if (type === 'song') {
            await Song.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });
            
            const song = await Song.findById(targetId).populate('artist');
            if (song && song.artist && song.artist.userId.toString() !== req.user._id.toString()) {
                const notification = new Notification({
                    user: song.artist.userId,
                    type: 'like',
                    title: 'New Like',
                    message: `${req.user.username} liked your song "${song.title}"`,
                    data: { songId: targetId, type: 'song' }
                });
                await notification.save();
                
                const io = getIO();
                io.to(`user:${song.artist.userId}`).emit('notification', notification);
            }
        } else if (type === 'comment') {
            await Comment.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });
            
            const comment = await Comment.findById(targetId);
            if (comment && comment.user.toString() !== req.user._id.toString()) {
                const notification = new Notification({
                    user: comment.user,
                    type: 'like',
                    title: 'New Like',
                    message: `${req.user.username} liked your comment`,
                    data: { commentId: targetId, type: 'comment' }
                });
                await notification.save();
                
                const io = getIO();
                io.to(`user:${comment.user}`).emit('notification', notification);
            }
        }
        
        res.json({ liked: true, message: 'Like added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
};

export const getUserLikes = async (req, res) => {
    try {
        const { type, page = 1, limit = 20 } = req.query;
        
        const query = { user: req.user._id };
        if (type) query.type = type;
        
        const likes = await Like.find(query)
            .populate('song', 'title coverArt artist duration playCount')
            .populate('comment', 'content user createdAt')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Like.countDocuments(query);
        
        res.json({
            likes,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
};

export const checkLikeStatus = async (req, res) => {
    try {
        const { type, targetId } = req.params;
        
        const like = await Like.findOne({
            user: req.user._id,
            type: type,
            [type === 'song' ? 'song' : 'comment']: targetId
        });
        
        res.json({ liked: !!like });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check like status' });
    }
};