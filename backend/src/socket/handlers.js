const socketEvents = require('./events');
const Comment = require('../models/Comment');
const Song = require('../models/Song');
const Notification = require('../models/Notification');

const handleConnection = (io, socket) => {
    console.log(`User connected: ${socket.user.username}`);
    
    // Join user's personal room
    socket.join(`user:${socket.user._id}`);
    
    // Handle joining song room
    socket.on(socketEvents.JOIN_ROOM, async ({ room }) => {
        socket.join(room);
        socket.emit(socketEvents.ROOM_JOINED, { room });
        
        if (room.startsWith('song:')) {
            const songId = room.split(':')[1];
            const listenerCount = io.sockets.adapter.rooms.get(room)?.size || 1;
            io.to(room).emit(socketEvents.LISTENER_COUNT, { count: listenerCount });
        }
    });
    
    // Handle leaving room
    socket.on(socketEvents.LEAVE_ROOM, ({ room }) => {
        socket.leave(room);
    });
    
    // Handle stream start
    socket.on(socketEvents.STREAM_START, async ({ songId }) => {
        const room = `song:${songId}`;
        socket.join(room);
        
        const song = await Song.findById(songId);
        if (song) {
            await song.incrementPlayCount();
            
            const listenerCount = io.sockets.adapter.rooms.get(room)?.size || 1;
            io.to(room).emit(socketEvents.LISTENER_JOINED, {
                username: socket.user.username,
                listenerCount
            });
        }
    });
    
    // Handle stream end
    socket.on(socketEvents.STREAM_END, ({ songId }) => {
        const room = `song:${songId}`;
        socket.leave(room);
        
        const listenerCount = io.sockets.adapter.rooms.get(room)?.size || 0;
        io.to(room).emit(socketEvents.LISTENER_LEFT, {
            username: socket.user.username,
            listenerCount
        });
    });
    
    // Handle new comment
    socket.on(socketEvents.NEW_COMMENT, async ({ songId, content, parentCommentId }) => {
        const comment = new Comment({
            user: socket.user._id,
            song: songId,
            content,
            parentComment: parentCommentId || null
        });
        
        await comment.save();
        await comment.populate('user', 'username avatar');
        
        const song = await Song.findById(songId);
        song.commentCount++;
        await song.save();
        
        // Emit to all users in song room
        io.to(`song:${songId}`).emit(socketEvents.COMMENT_ADDED, comment);
        
        // Notify artist
        if (song.artist.userId.toString() !== socket.user._id.toString()) {
            const notification = new Notification({
                user: song.artist.userId,
                type: 'comment',
                title: 'New Comment',
                message: `${socket.user.username} commented on your song "${song.title}"`,
                data: { songId, commentId: comment._id }
            });
            await notification.save();
            
            io.to(`user:${song.artist.userId}`).emit(socketEvents.NOTIFICATION, notification);
        }
        
        // If reply, notify parent comment owner
        if (parentCommentId) {
            const parentComment = await Comment.findById(parentCommentId);
            if (parentComment && parentComment.user.toString() !== socket.user._id.toString()) {
                const replyNotification = new Notification({
                    user: parentComment.user,
                    type: 'comment',
                    title: 'New Reply',
                    message: `${socket.user.username} replied to your comment`,
                    data: { songId, commentId: comment._id }
                });
                await replyNotification.save();
                io.to(`user:${parentComment.user}`).emit(socketEvents.NOTIFICATION, replyNotification);
            }
        }
    });
    
    // Handle typing indicator
    socket.on(socketEvents.TYPING, ({ songId, isTyping }) => {
        socket.to(`song:${songId}`).emit(socketEvents.USER_TYPING, {
            username: socket.user.username,
            isTyping
        });
    });
    
    // Handle like notification
    socket.on(socketEvents.LIKE_SONG, ({ songId, ownerId }) => {
        if (ownerId !== socket.user._id.toString()) {
            const notification = new Notification({
                user: ownerId,
                type: 'like',
                title: 'New Like',
                message: `${socket.user.username} liked your song`,
                data: { songId }
            });
            notification.save();
            io.to(`user:${ownerId}`).emit(socketEvents.NOTIFICATION, notification);
        }
    });
    
    // Handle follow
    socket.on(socketEvents.FOLLOW_USER, ({ followedUserId }) => {
        if (followedUserId !== socket.user._id.toString()) {
            const notification = new Notification({
                user: followedUserId,
                type: 'follow',
                title: 'New Follower',
                message: `${socket.user.username} started following you`,
                data: { followerId: socket.user._id }
            });
            notification.save();
            io.to(`user:${followedUserId}`).emit(socketEvents.NOTIFICATION, notification);
        }
    });
    
    // Handle share
    socket.on(socketEvents.SHARE_SONG, ({ songId, sharedWithUserId }) => {
        if (sharedWithUserId !== socket.user._id.toString()) {
            const notification = new Notification({
                user: sharedWithUserId,
                type: 'share',
                title: 'Song Shared',
                message: `${socket.user.username} shared a song with you`,
                data: { songId }
            });
            notification.save();
            io.to(`user:${sharedWithUserId}`).emit(socketEvents.NOTIFICATION, notification);
        }
    });
    
    // Handle disconnection
    socket.on(socketEvents.DISCONNECT, () => {
        console.log(`User disconnected: ${socket.user.username}`);
    });
};

module.exports = { handleConnection };