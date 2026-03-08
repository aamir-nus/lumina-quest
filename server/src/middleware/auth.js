import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return next(new ApiError(401, 'MISSING_TOKEN', 'Missing token'));
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch (error) {
    return next(new ApiError(401, 'INVALID_TOKEN', 'Invalid token', { message: error.message }));
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(new ApiError(403, 'FORBIDDEN', 'Forbidden'));
    }
    return next();
  };
}
