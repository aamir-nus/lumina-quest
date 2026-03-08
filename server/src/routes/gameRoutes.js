import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { validatePublishability } from '../utils/validateGameTemplate.js';
import { ApiError } from '../errors/ApiError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

const avenueSchema = z.object({
  avenueId: z.string().min(1),
  label: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  points: z.number(),
  nextSceneId: z.string().min(1),
  visualEffects: z
    .object({
      transition: z.string().default('fade'),
      spriteMood: z.string().default(''),
      setTheme: z.string().default(''),
      enableLayers: z.array(z.string()).default([]),
      disableLayers: z.array(z.string()).default([])
    })
    .default({
      transition: 'fade',
      spriteMood: '',
      setTheme: '',
      enableLayers: [],
      disableLayers: []
    })
});

const sceneSchema = z.object({
  sceneId: z.string().min(1),
  narrative: z.string().min(1),
  imageKey: z.string().default(''),
  isTerminal: z.boolean().default(false),
  renderConfig: z
    .object({
      theme: z.string().default('pastel'),
      backgroundLayers: z.array(z.string()).default([]),
      foregroundLayers: z.array(z.string()).default([]),
      sprite: z
        .object({
          id: z.string().default('hero'),
          mood: z.string().default('neutral'),
          x: z.number().default(0.5),
          y: z.number().default(0.82)
        })
        .default({ id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 })
    })
    .default({
      theme: 'pastel',
      backgroundLayers: [],
      foregroundLayers: [],
      sprite: { id: 'hero', mood: 'neutral', x: 0.5, y: 0.82 }
    }),
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

router.get('/public', asyncHandler(async (_req, res) => {
  const games = await GameTemplate.find({ status: 'public' }).sort({ createdAt: -1 }).lean();
  return res.json({ games });
}));

router.use(requireAuth);

router.get('/mine', asyncHandler(async (req, res) => {
  const games = await GameTemplate.find({ adminId: req.user.id }).sort({ updatedAt: -1 }).lean();
  return res.json({ games });
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const parsed = gameSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_GAME_PAYLOAD', 'Invalid game payload', parsed.error.flatten());
  }

  const game = await GameTemplate.create({ ...parsed.data, adminId: req.user.id });
  return res.status(201).json({ game });
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }

  const parsed = gameSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_GAME_PAYLOAD', 'Invalid game payload', parsed.error.flatten());
  }

  const game = await GameTemplate.findOneAndUpdate(
    { _id: req.params.id, adminId: req.user.id },
    { ...parsed.data, status: 'draft' },
    { new: true }
  );

  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  return res.json({ game });
}));

router.post('/:id/publish', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }

  const game = await GameTemplate.findOne({ _id: req.params.id, adminId: req.user.id });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  const result = validatePublishability(game);
  if (!result.ok) {
    throw new ApiError(400, 'GAME_NOT_PUBLISHABLE', 'Game is not publishable', result.errors);
  }

  game.status = 'public';
  await game.save();
  return res.json({ game });
}));

export default router;
