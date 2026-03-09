import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { env } from './config/env.js';
import { getDbStatus } from './config/db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sanitizeInput } from './middleware/sanitizeInput.js';
import { apiRateLimiter, authRateLimiter, securityHeaders } from './middleware/security.js';
import { requestId } from './middleware/requestId.js';

export const app = express();
const api = express.Router();

app.disable('x-powered-by');
app.use(securityHeaders);
const allowedOrigins = env.clientOrigin.split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true
}));
app.use(requestId);
app.use(apiRateLimiter);
app.use(express.json({ limit: env.requestJsonLimit }));
app.use(cookieParser());
app.use(sanitizeInput);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'lumina-quest-server', db: getDbStatus() });
});

api.use('/auth', authRateLimiter, authRoutes);
api.use('/games', gameRoutes);
api.use('/sessions', sessionRoutes);
api.use('/admin', adminRoutes);

app.use('/api', api);
app.use('/api/v1', api);

app.use(notFoundHandler);
app.use(errorHandler);
