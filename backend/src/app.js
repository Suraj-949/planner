const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookies = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { csrfGuard } = require('./middleware/csrf.middleware');
const { requestIdMiddleware } = require('./middleware/requestId.middleware');
const { ApiError } = require('./utils/http');
const { errorHandler } = require('./middleware/error.middleware');
const { ok } = require('./utils/response');

const app = express();

/*
 * Origin allow-list. The hand-written header block this replaced always answered with a
 * single hardcoded localhost origin, so any other client — including a page on another
 * port — was silently refused, while `Access-Control-Allow-Credentials: true` was sent
 * unconditionally.
 */
const ALLOWED_ORIGINS = (
    process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(requestIdMiddleware);

app.use(
    helmet({
        // The API is consumed cross-origin by a Vite dev server, so the default
        // same-origin policy would block every response.
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);

app.use(
    cors({
        origin(origin, callback) {
            // No Origin header: same-origin, curl, or a server-to-server call.
            if (!origin) return callback(null, true);

            if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

            return callback(new ApiError(403, `Origin ${origin} is not allowed`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

app.use(cookies());
// 1mb default was inherited from the template; a task body is far smaller, and an
// unbounded parser is a cheap DoS vector.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));


app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
    ok(res, 200, { status: 'ok', uptime: process.uptime() });
});

// Applied before the routers so every cookie-bearing state-changing request is checked.
app.use('/api', csrfGuard);

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Any request that reached this point matched no route.
app.use((req, res, next) => {
    next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
});

app.use(errorHandler);

module.exports = app;
