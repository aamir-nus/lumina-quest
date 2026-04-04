import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}

export function errorHandler(err, _req, res, _next) {
  const requestId = _req.requestId || 'n/a';
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = status >= 500 ? 'Internal server error' : err.message;

  logger.error('Request failed', {
    requestId,
    code,
    status,
    message: err.message,
    stack: err.stack,
    details: err.details || null
  });

  return res.status(status).json({
    error: {
      code,
      message,
      requestId,
      ...(err.details ? { details: err.details } : {})
    }
  });
}
