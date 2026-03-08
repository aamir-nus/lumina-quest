import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import gameRoutes from './routes/gameRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { env } from './config/env.js';
import { getDbStatus } from './config/db.js';

export const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'lumina-quest-server', db: getDbStatus() });
});

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
