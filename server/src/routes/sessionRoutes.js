import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { resolveAvenue } from '../services/llmResolver.js';

const router = express.Router();

const startSchema = z.object({
  gameId: z.string().min(1)
});

const actionSchema = z.object({
  sessionId: z.string().min(1),
  userInput: z.string().min(1)
});

router.use(requireAuth);

router.post('/start', async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  if (!mongoose.isValidObjectId(parsed.data.gameId)) {
    return res.status(400).json({ error: 'Invalid gameId' });
  }

  const game = await GameTemplate.findOne({ _id: parsed.data.gameId, status: 'public' });
  if (!game) {
    return res.status(404).json({ error: 'Game not found or not public' });
  }

  const session = await PlayerSession.create({
    userId: req.user.id,
    gameId: game._id,
    currentSceneId: game.startSceneId,
    stats: { points: 0, turnsUsed: 0 },
    history: []
  });

  return res.status(201).json({ session });
});

router.get('/:sessionId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  const session = await PlayerSession.findOne({ _id: req.params.sessionId, userId: req.user.id }).lean();
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const game = await GameTemplate.findById(session.gameId).lean();
  const currentScene = game?.scenes?.find((scene) => scene.sceneId === session.currentSceneId) || null;

  return res.json({ session, game, currentScene });
});

router.post('/action', async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  if (!mongoose.isValidObjectId(parsed.data.sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  const session = await PlayerSession.findOne({ _id: parsed.data.sessionId, userId: req.user.id });
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.status !== 'active') {
    return res.status(409).json({ error: 'Session already finished', status: session.status });
  }

  const game = await GameTemplate.findById(session.gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game for session no longer exists' });
  }
  const currentScene = game.scenes.find((scene) => scene.sceneId === session.currentSceneId);

  if (!currentScene || currentScene.isTerminal || currentScene.avenues.length === 0) {
    session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
    await session.save();
    return res.json({
      session,
      resolution: {
        narration: 'This story branch is complete.',
        selectedAvenueId: null,
        reason: 'terminal_or_no_moves'
      }
    });
  }

  const mapped = await resolveAvenue({
    gameTitle: game.title,
    sceneNarrative: currentScene.narrative,
    input: parsed.data.userInput,
    avenues: currentScene.avenues,
    history: session.history
  });

  const selected =
    currentScene.avenues.find((a) => a.avenueId === mapped.selectedAvenueId) || currentScene.avenues[0];

  session.stats.points += selected.points;
  session.stats.turnsUsed += 1;
  session.currentSceneId = selected.nextSceneId;

  const nextScene = game.scenes.find((scene) => scene.sceneId === selected.nextSceneId);
  const isTerminal = nextScene?.isTerminal || false;
  const maxTurnsReached = session.stats.turnsUsed >= game.constraints.maxTurns;

  if (isTerminal || maxTurnsReached) {
    session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
  }

  session.history.push({
    turn: session.stats.turnsUsed,
    sceneId: currentScene.sceneId,
    userQuery: parsed.data.userInput,
    resolvedAvenueId: selected.avenueId,
    narration: `You chose: ${selected.label}`,
    pointsDelta: selected.points
  });

  await session.save();

  return res.json({
    session,
    currentScene: nextScene,
    resolution: {
      selectedAvenueId: selected.avenueId,
      reason: mapped.reason,
      narration: `Action resolved: ${selected.label}. ${nextScene?.narrative || ''}`,
      providerResponse: mapped.providerResponse
    }
  });
});

export default router;
