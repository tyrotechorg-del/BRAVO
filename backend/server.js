import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './src/config/database.js';
import { configureSocket } from './src/config/socket.js';
import securityMiddleware from './src/middleware/security.js';
import errorHandler from './src/middleware/errorHandler.js';

// Import routes
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import songRoutes from './src/routes/songRoutes.js';
import albumRoutes from './src/routes/albumRoutes.js';
import artistRoutes from './src/routes/artistRoutes.js';
import subscriptionRoutes from './src/routes/subscriptionRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import playlistRoutes from './src/routes/playlistRoutes.js';
import commentRoutes from './src/routes/commentRoutes.js';
import searchRoutes from './src/routes/searchRoutes.js';
import downloadRoutes from './src/routes/downloadRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import promotionRoutes from './src/routes/promotionRoutes.js';
import walletRoutes from './src/routes/walletRoutes.js';
import analyticsRoutes from './src/routes/analyticsRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }
});

// Socket configuration
configureSocket(io);

// Security middleware
app.use(securityMiddleware);
app.use(compression());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));


// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Bravo Music API',
        version: '2.0.0',
        status: 'running',
        endpoints: '/api/'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Database connection and server start
const PORT = process.env.PORT;

const startServer = async () => {
    try {
        await connectDB();
        
        httpServer.listen(PORT, '0.0.0.0',  () => {
            console.log('\n' + '='.repeat(60));
            console.log('🎵 BRAVO MUSIC API SERVER');
            console.log('='.repeat(60));
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`📋 API: http://localhost:${PORT}/api`);
            console.log(`✅ Health: http://localhost:${PORT}/api/health`);
            console.log('='.repeat(60));
            console.log('\n🔐 Test Accounts (after seeding):');
            console.log('   👤 Listener: demo@example.com / password123');
            console.log('   🎨 Artist:   artist@example.com / password123');
            console.log('   👑 Admin:    admin@bravomusic.com / Admin@123');
            console.log('\n' + '='.repeat(60));
            console.log('✨ Server ready!\n');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export { app, io };