import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io = null;

export const configureSocket = (socketIO) => {
    io = socketIO;
    
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            
            if (!user || !user.isActive) {
                return next(new Error('User not found or inactive'));
            }
            
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });
    
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.user?.username || 'Unknown'}`);
        socket.join(`user:${socket.user?._id}`);
        
        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.user?.username || 'Unknown'}`);
        });
    });
    
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

export default { configureSocket, getIO };