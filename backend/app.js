// Express application (no network listener here, so tests can import it).
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Render / any reverse proxy: needed so rate limiting sees the real client IP
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin images (Cloudinary)
}));

// Global API rate limiter
app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.RATE_LIMIT_MAX) || 300, // per IP per window
    message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
}));

// CORS: FRONTEND_URL may be a comma separated list. Localhost is allowed outside production.
const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
if (!isProd) allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');

app.use(cors({
    origin(origin, callback) {
        // Requests without an Origin header (curl, server-to-server, health checks) are allowed
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        const err = new Error('Not allowed by CORS');
        err.status = 403;
        return callback(err);
    },
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve local fallback uploads statically (only used when Cloudinary is not configured)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check (used by Render)
app.get('/api/health', async (req, res) => {
    const ok = await db.ping();
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', db: ok ? 'connected' : 'disconnected' });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/resume', require('./routes/resumeRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/user', require('./routes/analyticsRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

app.get('/', (req, res) => {
    res.send('AI Resume & Interview Platform API is running');
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Central error handler: never leak internals in production
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);
    if (err.type === 'entity.parse.failed') status = 400;
    if (status >= 500) console.error(err);
    res.status(status).json({
        message: status >= 500 && isProd ? 'Internal server error' : err.message,
    });
});

module.exports = app;
