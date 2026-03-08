import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { AUTH } from '../constants/appConstants.js';
import { ApiError } from '../errors/ApiError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']).optional()
});

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid input', parsed.error.flatten());
  }

  const { email, password, role } = parsed.data;
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'EMAIL_EXISTS', 'Email already exists');
  }

  const passwordHash = await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);
  const user = await User.create({ email, passwordHash, role: role || 'user' });

  const token = jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: AUTH.JWT_EXPIRES_IN
  });

  return res.status(201).json({ token, user: { id: user._id, email: user.email, role: user.role } });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = authSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid input');
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const token = jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: AUTH.JWT_EXPIRES_IN
  });

  return res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
}));

export default router;
