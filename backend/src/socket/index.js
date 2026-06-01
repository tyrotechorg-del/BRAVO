const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');

module.exports = (io) => {
    // Authentication middleware for socket.io
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            
            if (!user) {
                return next(new Error('User not found'));
            }
            
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication failed'));
        }
    });
    
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.username}`);
        
        // Join user's personal room
        socket.join(`user:${socket.user._id}`);
        
        // Handle new comment
        socket.on('new-comment', async (data) => {
            const { songId, comment } = data;
            
            // Save comment to database
            const newComment = new Comment({
                user: socket.user._id,
                song: songId,
                content: comment
            });
            
            await newComment.save();
            
            // Emit to all users listening to this song
            io.to(`song:${songId}`).emit('comment-added', newComment);
            
            // Notify song artist
            const song = await Song.findById(songId).populate('artist');
            if (song.artist.userId.toString() !== socket.user._id.toString()) {
                io.to(`user:${song.artist.userId}`).emit('notification', {
                    type: 'comment',
                    message: `${socket.user.username} commented on your song: ${song.title}`,
                    data: { songId, commentId: newComment._id }
                });
            }
        });
        
        // Handle typing indicator
        socket.on('typing', (data) => {
            socket.to(`song:${data.songId}`).emit('user-typing', {
                username: socket.user.username,
                isTyping: data.isTyping
            });
        });
        
        // Handle song stream start
        socket.on('stream-start', async (data) => {
            const { songId } = data;
            
            // Join song room
            socket.join(`song:${songId}`);
            
            // Update play count
            const song = await Song.findById(songId);
            if (song) {
                await song.incrementPlayCount();
                
                // Update artist analytics
                const artist = await Artist.findById(song.artist);
                if (artist) {
                    artist.monthlyListeners++;
                    artist.totalStreams++;
                    await artist.save();
                }
                
                // Track analytics
                const analytics = new Analytics({
                    user: socket.user._id,
                    song: songId,
                    action: 'stream',
                    timestamp: new Date()
                });
                await analytics.save();
            }
            
            // Broadcast to other listeners
            socket.to(`song:${songId}`).emit('listener-joined', {
                username: socket.user.username,
                listenerCount: io.sockets.adapter.rooms.get(`song:${songId}`)?.size || 1
            });
        });
        
        // Handle song stream end
        socket.on('stream-end', (data) => {
            const { songId } = data;
            socket.leave(`song:${songId}`);
            
            const listenerCount = io.sockets.adapter.rooms.get(`song:${songId}`)?.size || 0;
            socket.to(`song:${songId}`).emit('listener-left', {
                username: socket.user.username,
                listenerCount
            });
        });
        
        // Handle like notification
        socket.on('like', (data) => {
            const { targetId, targetType, targetOwnerId } = data;
            
            if (targetOwnerId !== socket.user._id) {
                io.to(`user:${targetOwnerId}`).emit('notification', {
                    type: 'like',
                    message: `${socket.user.username} liked your ${targetType}`,
                    data: { targetId, targetType }
                });
            }
        });
        
        // Handle follow notification
        socket.on('follow', (data) => {
            const { followedUserId } = data;
            
            if (followedUserId !== socket.user._id) {
                io.to(`user:${followedUserId}`).emit('notification', {
                    type: 'follow',
                    message: `${socket.user.username} started following you`,
                    data: { followerId: socket.user._id }
                });
            }
        });
        
        // Handle share
        socket.on('share', (data) => {
            const { songId, sharedWithUserId } = data;
            
            io.to(`user:${sharedWithUserId}`).emit('notification', {
                type: 'share',
                message: `${socket.user.username} shared a song with you`,
                data: { songId }
            });
        });
        
        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username}`);
        });
    });
};