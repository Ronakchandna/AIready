const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
require('dotenv').config();

// Fail fast with a clear message instead of crashing later
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
    console.error(`FATAL: missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Render / any reverse proxy: needed so rate limiting sees the real client IP
app.set('trust proxy', 1);

// Security Middleware (HTTP Headers)
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin images (Cloudinary)
}));

// Global API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // per IP per window
    message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

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

// Data sanitization against NoSQL query injection
app.use((req, res, next) => {
    if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: '_' });
    if (req.query) mongoSanitize.sanitize(req.query, { replaceWith: '_' });
    if (req.params) mongoSanitize.sanitize(req.params, { replaceWith: '_' });
    next();
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => console.error('MongoDB connection error:', err.message));

// Health check (used by Render)
app.get('/api/health', (req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(db === 'connected' ? 200 : 503).json({ status: db === 'connected' ? 'ok' : 'degraded', db });
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/resume', require('./routes/resumeRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/user', require('./routes/analyticsRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// Basic Route for testing
app.get('/', (req, res) => {
    res.send('AI Resume & Interview Platform API is running');
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Central error handler: never leak stack traces in production
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({
        message: status >= 500 && isProd ? 'Internal server error' : err.message,
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
