import express from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { analyzeGameGraph } from '../services/sceneGraphAnalysisService.js';
import { getResolverMetrics } from '../services/resolverMetricsService.js';
import { getRecentTraces } from '../services/traceService.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.post('/games/:gameId/analyze', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.gameId)) {
    return res.status(400).json({ error: 'Invalid game id' });
  }

  const game = await GameTemplate.findOne({ _id: req.params.gameId, adminId: req.user.id }).lean();
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const analysis = analyzeGameGraph(game);
  return res.json(analysis);
});

router.post('/games/:gameId/playtest', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.gameId)) {
    return res.status(400).json({ error: 'Invalid game id' });
  }

  const game = await GameTemplate.findOne({ _id: req.params.gameId, adminId: req.user.id });
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const requestedScene = String(req.body?.startSceneId || '').trim();
  const availableSceneIds = new Set(game.scenes.map((scene) => scene.sceneId));
  const startSceneId = availableSceneIds.has(requestedScene) ? requestedScene : game.startSceneId;

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
    history: []
  });

  return res.status(201).json({ session });
});

router.get('/observability/resolver', async (_req, res) => {
  return res.json({
    metrics: getResolverMetrics(),
    traces: getRecentTraces(15)
  });
});

export default router;
