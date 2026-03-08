import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { validatePublishability } from '../utils/validateGameTemplate.js';

const router = express.Router();

const avenueSchema = z.object({
  avenueId: z.string().min(1),
  label: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  points: z.number(),
  nextSceneId: z.string().min(1)
});

const sceneSchema = z.object({
  sceneId: z.string().min(1),
  narrative: z.string().min(1),
  imageKey: z.string().default(''),
  isTerminal: z.boolean().default(false),
  avenues: z.array(avenueSchema)
});

const gameSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  constraints: z.object({
    maxTurns: z.number().min(1),
    targetPoints: z.number().min(0)
  }),
  wildcardConfig: z
    .object({
      enabled: z.boolean().default(false),
      recoverySceneId: z.string().default(''),
      highRewardPoints: z.number().default(2),
      lowRewardPoints: z.number().default(0)
    })
    .default({ enabled: false, recoverySceneId: '', highRewardPoints: 2, lowRewardPoints: 0 }),
  startSceneId: z.string().min(1),
  scenes: z.array(sceneSchema).min(1)
});

router.get('/public', async (_req, res) => {
  const games = await GameTemplate.find({ status: 'public' }).sort({ createdAt: -1 }).lean();
  return res.json({ games });
});

router.use(requireAuth);

router.get('/mine', async (req, res) => {
  const games = await GameTemplate.find({ adminId: req.user.id }).sort({ updatedAt: -1 }).lean();
  return res.json({ games });
});

router.post('/', requireRole('admin'), async (req, res) => {
  const parsed = gameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid game payload', details: parsed.error.flatten() });
  }

  const game = await GameTemplate.create({ ...parsed.data, adminId: req.user.id });
  return res.status(201).json({ game });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid game id' });
  }

  const parsed = gameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid game payload', details: parsed.error.flatten() });
  }

  const game = await GameTemplate.findOneAndUpdate(
    { _id: req.params.id, adminId: req.user.id },
    { ...parsed.data, status: 'draft' },
    { new: true }
  );

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  return res.json({ game });
});

router.post('/:id/publish', requireRole('admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid game id' });
  }

  const game = await GameTemplate.findOne({ _id: req.params.id, adminId: req.user.id });
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const result = validatePublishability(game);
  if (!result.ok) {
    return res.status(400).json({ error: 'Game is not publishable', details: result.errors });
  }

  game.status = 'public';
  await game.save();
  return res.json({ game });
});

export default router;
