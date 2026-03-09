import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { env } from './config/env.js';
import { getDbStatus } from './config/db.js';
import { ApiError } from './errors/ApiError.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sanitizeInput } from './middleware/sanitizeInput.js';
import { apiRateLimiter, authRateLimiter, securityHeaders } from './middleware/security.js';
import { requestId } from './middleware/requestId.js';

export const app = express();
const api = express.Router();

function parseByteLimit(limit) {
  if (typeof limit === 'number' && Number.isFinite(limit)) return limit;
  const normalized = String(limit || '').trim().toLowerCase();
  const match = normalized.match(/^(\d+)(b|kb|mb)?$/);
  if (!match) return 256 * 1024;
  const value = Number(match[1]);
  const unit = match[2] || 'b';
  if (unit === 'mb') return value * 1024 * 1024;
  if (unit === 'kb') return value * 1024;
  return value;
}

app.disable('x-powered-by');
app.use(securityHeaders);
const allowedOrigins = env.clientOrigin.split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      if (env.corsAllowNoOrigin) return callback(null, true);
      return callback(new ApiError(403, 'CORS_ORIGIN_MISSING', 'CORS origin missing'));
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new ApiError(403, 'CORS_ORIGIN_BLOCKED', 'CORS origin not allowed'));
  },
  credentials: true
}));
app.use(requestId);
app.use(apiRateLimiter);
app.use((req, _res, next) => {
  const contentLength = Number(req.headers['content-length'] || 0);
  const maxBytes = parseByteLimit(env.requestJsonLimit);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return next(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request entity too large'));
  }
  return next();
});
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
