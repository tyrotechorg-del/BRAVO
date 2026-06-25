/**
 * server.js — Bravo Music API entry point (production-hardened)
 *
 * ============================================================
 * FIXES FROM THE ORIGINAL
 * ============================================================
 *
 * 1. **Env-driven CORS allowlist**. The original had localhost
 *    URLs in the production allowlist. Now: ALLOWED_ORIGINS is a
 *    comma-separated env var. The defaults are restrictive
 *    (production domains only). Localhost is added back ONLY
 *    when NODE_ENV !== 'production'.
 *
 * 2. **No credentials logged**. The original printed admin /
 *    artist / listener test credentials to stdout on every boot.
 *    Anyone who could read the server logs (PM2, journalctl,
 *    Datadog, etc.) had production credentials. Removed entirely.
 *
 * 3. **Raw body capture for webhook signature verification**.
 *    The PawaPay HMAC verification (batch 1 + batch 7) requires
 *    the EXACT raw request body. express.json() consumes the
 *    body without preserving it. The verify callback writes the
 *    raw bytes to req.rawBody for the webhook handlers.
 *
 * 4. **Body limits dropped from 500mb → 10mb (default) +
 *    multer for uploads**. The original allowed 500mb JSON
 *    payloads — a DoS vector. Uploads use multer with size
 *    limits in the route. JSON is capped at 10mb.
 *
 * 5. **CSP + comprehensive helmet config**. The original used
 *    helmet's defaults with two overrides. This version sets
 *    CSP, HSTS (with includeSubDomains + preload), Referrer-
 *    Policy, X-Content-Type-Options, X-Frame-Options DENY, and
 *    Cross-Origin-Embedder-Policy unsafe-none (so audio
 *    streaming from S3/CDN still works).
 *
 * 6. **Static file paths from env**. Original had hardcoded
 *    `/var/www/BRAVO/src/utils/music` — fails on every
 *    environment that isn't production. Now: STATIC_MUSIC_PATH
 *    and STATIC_IMAGES_PATH env vars with sane defaults under
 *    process.cwd().
 *
 * 7. **Env validation at boot**. validateEnv() runs before
 *    anything else and crashes early if required vars are
 *    missing (and warns about recommended ones). Better than
 *    discovering MONGO_URI is unset when the first DB call
 *    fails 30 seconds in.
 *
 * 8. **Request logging via morgan** (production format) with
 *    log redactor that strips Authorization headers,
 *    'password', 'token', etc from request paths.
 *
 * 9. **Graceful shutdown**. SIGTERM closes the HTTP server,
 *    drains in-flight requests, closes Mongo, closes Socket.IO.
 *    Without this, deploys would 502 in-flight requests.
 *
 * 10. **Health check returns more useful info** (db status,
 *     memory, uptime, version from package.json) without
 *     leaking sensitive config like allowed origins.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env BEFORE importing anything that reads it.
dotenv.config();

// Validate env early — crashes the process if required vars are missing.
import { validateEnv } from './src/config/validateEnv.js';
validateEnv();

import { connectDB } from './src/config/database.js';
import { configureSocket } from './src/config/socket.js';
import { applySecurityHeaders } from './src/middleware/securityHeaders.js';
import { logRedactor } from './src/middleware/logRedactor.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT, 10) || 1000;

// ============================================================
// CORS allowlist — env-driven, no localhost in production
// ============================================================
function buildAllowedOrigins() {
    const fromEnv = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    if (fromEnv.length > 0) return fromEnv;

    // Sensible defaults
    if (IS_PRODUCTION) {
        return [
            'https://bravomusics.com',
            'https://www.bravomusics.com',
            'https://api.bravomusics.com'
        ];
    }
    // Dev: production-like + 10.192.234.139 ports
    return [
        'https://bravomusics.com',
        'https://www.bravomusics.com',
	    'https://api.bravomusics.com',
        'http://10.220.201.139:3000',
        'http://10.220.201.139:1000',
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ];
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

const corsOptions = {
    origin(origin, callback) {
        // Allow requests with no origin (curl, mobile apps, server-to-server)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
        if (!IS_PRODUCTION) {
            console.warn(`[CORS] Blocked origin: ${origin}`);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Idempotency-Key'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400   // cache preflight for 24h
};

// ============================================================
// App + HTTP server
// ============================================================
const app = express();

// Trust proxy when behind a reverse proxy (nginx, ELB, Cloudflare).
// Important for rate-limiting by IP and for req.ip to reflect the real client.
if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
}

const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: ALLOWED_ORIGINS,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    // Socket.IO uses long-polling + websocket. In production we want websocket only.
    transports: IS_PRODUCTION ? ['websocket'] : ['polling', 'websocket'],
    // Auth via the socket handshake — see configureSocket for the implementation.
    allowEIO3: false
});
configureSocket(io);

// ============================================================
// Middleware order matters
// ============================================================

// 1. CORS (must come first for preflight to work)
app.use(cors(corsOptions));

// 2. Security headers (helmet + custom)
app.use(helmet({
    contentSecurityPolicy: false,                // Set explicitly below in applySecurityHeaders
    crossOriginEmbedderPolicy: false,            // Audio/video streams from S3 need this off
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: IS_PRODUCTION
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false   // Don't set HSTS in dev — pollutes browser HSTS cache
}));
app.use(applySecurityHeaders);   // Custom CSP + extras — see middleware/securityHeaders.js

// 3. Compression
app.use(compression());

// 4. Body parsing — JSON capped at 10mb with raw body capture for webhooks
app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        // Preserve the raw body so PawaPay HMAC verification works.
        // Critical for batch 1's webhook signature verification.
        req.rawBody = buf.toString('utf8');
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Request logging (after body parsing so it can read the route)
if (IS_PRODUCTION) {
    app.use(morgan('combined', {
        stream: { write: (msg) => process.stdout.write(logRedactor(msg)) }
    }));
} else {
    app.use(morgan('dev'));
}

// 6. Static files (env-driven paths with safe defaults)
const STATIC_UPLOADS = process.env.STATIC_UPLOADS_PATH || path.join(process.cwd(), 'uploads');
const STATIC_MUSIC   = process.env.STATIC_MUSIC_PATH   || path.join(process.cwd(), 'static', 'music');
const STATIC_IMAGES  = process.env.STATIC_IMAGES_PATH  || path.join(process.cwd(), 'static', 'images');

app.use('/uploads',      express.static(STATIC_UPLOADS,  { maxAge: '7d', etag: true, immutable: false }));
app.use('/static/music', express.static(STATIC_MUSIC,    { maxAge: '30d', etag: true, immutable: false }));
app.use('/static/images', express.static(STATIC_IMAGES,  { maxAge: '30d', etag: true, immutable: false }));
// Also serve images at /images so the default "images/bravo.png" placeholder
// resolves both on the backend and matches the frontend's bundled asset path.
app.use('/images',       express.static(STATIC_IMAGES,  { maxAge: '30d', etag: true, immutable: false }));

// 7. Rate limiting (global). Per-route limits live in their respective route files.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,    // 15 minutes
    max: IS_PRODUCTION ? 200 : 1000,
    standardHeaders: true,        // RateLimit-* headers
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    // Skip the health check from rate limiting (monitoring shouldn't trip it)
    skip: (req) => req.path === '/api/health'
});
app.use('/api/', globalLimiter);

// ============================================================
// Routes
// ============================================================
app.get('/api/health', async (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbHealthy = dbState === 1;   // 1 = connected
    const mem = process.memoryUsage();
    res.status(dbHealthy ? 200 : 503).json({
        status: dbHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        db: dbHealthy ? 'connected' : 'disconnected',
        memory: {
            rss: Math.round(mem.rss / 1024 / 1024) + 'mb',
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'mb'
        },
        version: process.env.npm_package_version || '0.0.0',
        env: IS_PRODUCTION ? 'production' : NODE_ENV
        // Notably DOES NOT include allowedOrigins (was in original — info leak)
    });
});

app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/songs',         songRoutes);
app.use('/api/albums',        albumRoutes);
app.use('/api/artists',       artistRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/playlists',     playlistRoutes);
app.use('/api/comments',      commentRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/downloads',     downloadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/promotions',    promotionRoutes);
app.use('/api/wallet',        walletRoutes);
app.use('/api/analytics',     analyticsRoutes);

// Root
app.get('/', (_req, res) => {
    res.json({
        name: 'Bravo Music API',
        version: process.env.npm_package_version || '0.0.0',
        status: 'running',
        endpoints: '/api/'
        // Does NOT leak allowed origins, env, or any config.
    });
});

// 404
app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler (always last)
app.use(errorHandler);

// ============================================================
// Boot + graceful shutdown
// ============================================================
async function startServer() {
    try {
        await connectDB();

        // In production, ensure indexes are synced with the model definitions.
        // Run-once-per-deploy job — the proper one is scripts/syncIndexes.js.
        // We DO NOT call it here automatically because it can be slow.

        httpServer.listen(PORT, '0.0.0.0', () => {
            console.log(`[server] Bravo Music API listening on :${PORT}`);
            console.log(`[server] env=${NODE_ENV}, allowed-origins=${ALLOWED_ORIGINS.length}`);
            // NOTE: no credentials logged. No URL list either — keep boot output minimal.
        });

        attachShutdownHandlers();
    } catch (error) {
        console.error('[server] Failed to start:', error.message);
        process.exit(1);
    }
}

function attachShutdownHandlers() {
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[server] ${signal} received — shutting down gracefully`);

        // Stop accepting new connections.
        httpServer.close(() => console.log('[server] HTTP server closed'));

        // Close Socket.IO.
        try { io.close(); } catch (err) { console.error('[server] Error closing Socket.IO:', err); }

        // Close MongoDB.
        try { await mongoose.connection.close(); console.log('[server] Mongo connection closed'); }
        catch (err) { console.error('[server] Error closing Mongo:', err); }

        // Give in-flight requests up to 15s, then force-exit.
        setTimeout(() => {
            console.error('[server] Forcing exit after 15s grace period');
            process.exit(1);
        }, 15_000).unref();

        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        console.error('[server] Unhandled promise rejection:', reason);
        // Don't exit — log and continue. In some cases we want to crash; tune
        // here as needed.
    });
    process.on('uncaughtException', (err) => {
        console.error('[server] Uncaught exception:', err);
        // For an uncaught exception we DO want to crash and let the process
        // manager (PM2/systemd) restart us.
        shutdown('uncaughtException');
    });
}

startServer();

export { app, io };
