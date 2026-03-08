import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

const router = express.Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']).optional()
});

router.post('/register', async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { email, password, role } = parsed.data;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, role: role || 'user' });

  const token = jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: '7d'
  });

  return res.status(201).json({ token, user: { id: user._id, email: user.email, role: user.role } });
});

router.post('/login', async (req, res) => {
  const parsed = authSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: '7d'
  });

  return res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
});

export default router;
