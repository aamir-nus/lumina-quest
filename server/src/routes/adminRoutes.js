import express from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { analyzeGameGraph } from '../services/sceneGraphAnalysisService.js';
import { getResolverMetrics } from '../services/resolverMetricsService.js';
import { getRecentTraces } from '../services/traceService.js';
import { ApiError } from '../errors/ApiError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { env } from '../config/env.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.post('/games/:gameId/analyze', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.gameId)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }

  const game = await GameTemplate.findOne({ _id: req.params.gameId, adminId: req.user.id }).lean();
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  const analysis = analyzeGameGraph(game);
  return res.json(analysis);
}));

router.post('/games/:gameId/playtest', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.gameId)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }

  const game = await GameTemplate.findOne({ _id: req.params.gameId, adminId: req.user.id });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  const requestedScene = String(req.body?.startSceneId || '').trim();
  const availableSceneIds = new Set(game.scenes.map((scene) => scene.sceneId));
  const startSceneId = availableSceneIds.has(requestedScene) ? requestedScene : game.startSceneId;
  const startScene = game.scenes.find((scene) => scene.sceneId === startSceneId);
  const startRender = startScene?.renderConfig || {};

  const session = await PlayerSession.create({
    userId: req.user.id,
    gameId: game._id,
    currentSceneId: startSceneId,
    isPlaytest: true,
    playtestMeta: {
      startedByAdminId: req.user.id,
      startSceneOverride: startSceneId
    },
    stats: { points: 0, turnsUsed: 0 },
    visualState: {
      theme: startRender.theme || 'pastel',
      activeLayers: [...(startRender.backgroundLayers || []), ...(startRender.foregroundLayers || [])],
      spriteMood: startRender.sprite?.mood || 'neutral',
      transition: 'fade'
    },
    history: []
  });

  return res.status(201).json({ session });
}));

router.get('/observability/resolver', asyncHandler(async (_req, res) => {
  return res.json({
    provider: env.llmProvider,
    providerOptions: ['openrouter', 'lmstudio'],
    metrics: getResolverMetrics(),
    traces: getRecentTraces(15)
  });
}));

export default router;
