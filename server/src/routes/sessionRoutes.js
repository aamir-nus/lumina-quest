import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { classifyRoute, generateNarration } from '../services/llmResolver.js';
import { evaluateWildcard } from '../services/wildcardPolicyService.js';
import { addSpan, endTrace, startTrace } from '../services/traceService.js';

const router = express.Router();

const startSchema = z.object({
  gameId: z.string().min(1)
});

const actionSchema = z.object({
  sessionId: z.string().min(1),
  userInput: z.string().min(1),
  tone: z.string().optional().default('cinematic')
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

router.get('/:sessionId/history', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  const session = await PlayerSession.findOne({ _id: req.params.sessionId, userId: req.user.id }).lean();
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.json({ history: session.history || [] });
});

async function actHandler(req, res) {
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
  const traceId = startTrace('session_action', {
    sessionId: session._id.toString(),
    gameId: game._id.toString()
  });

  if (!currentScene || currentScene.isTerminal || currentScene.avenues.length === 0) {
    session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
    await session.save();
    addSpan(traceId, 'terminal_resolution', { status: session.status });
    endTrace(traceId, { status: session.status });
    return res.json({
      session,
      resolution: {
        narration: 'This story branch is complete.',
        selectedAvenueId: null,
        reason: 'terminal_or_no_moves',
        type: 'clarification',
        confidence: 1,
        explanation: 'Session reached a terminal state.'
      }
    });
  }

  const classified = await classifyRoute({
    gameTitle: game.title,
    sceneNarrative: currentScene.narrative,
    input: parsed.data.userInput,
    avenues: currentScene.avenues,
    history: session.history,
    wildcardEnabled: Boolean(game.wildcardConfig?.enabled)
  });
  addSpan(traceId, 'classification', {
    routeType: classified.routeType,
    confidence: classified.confidence
  });

  if (classified.routeType === 'clarification') {
    const narration = await generateNarration({
      gameTitle: game.title,
      sceneNarrative: currentScene.narrative,
      playerInput: parsed.data.userInput,
      resolutionType: 'clarification',
      routeLabel: '',
      tone: parsed.data.tone
    });

    session.stats.turnsUsed += 1;
    const maxTurnsReached = session.stats.turnsUsed >= game.constraints.maxTurns;
    if (maxTurnsReached) {
      session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
    }

    session.history.push({
      turn: session.stats.turnsUsed,
      sceneId: currentScene.sceneId,
      userQuery: parsed.data.userInput,
      resolvedAvenueId: null,
      narration: narration.text,
      pointsDelta: 0
    });

    await session.save();
    addSpan(traceId, 'clarification', { maxTurnsReached });
    endTrace(traceId, { status: session.status, routeType: 'clarification' });
    return res.json({
      session,
      currentScene,
      resolution: {
        type: 'clarification',
        selectedAvenueId: null,
        wildcardMode: null,
        confidence: classified.confidence || 0.4,
        explanation: classified.explanation || 'Need more detail to map your intent safely.',
        narration: narration.text,
        providerResponse: classified.providerResponse,
        traceId
      }
    });
  }

  let resolutionType = 'avenue';
  let selectedAvenue = null;
  let pointsDelta = 0;
  let destinationSceneId = currentScene.sceneId;
  let wildcardMode = null;
  let explanation = classified.explanation || '';

  if (classified.routeType === 'wildcard') {
    const wildcardDecision = evaluateWildcard({
      game,
      currentScene,
      candidate: classified.wildcard || {}
    });
    addSpan(traceId, 'wildcard_policy', wildcardDecision);

    if (!wildcardDecision.approved) {
      const narration = await generateNarration({
        gameTitle: game.title,
        sceneNarrative: currentScene.narrative,
        playerInput: parsed.data.userInput,
        resolutionType: 'clarification',
        routeLabel: '',
        tone: parsed.data.tone
      });

      session.stats.turnsUsed += 1;
      session.history.push({
        turn: session.stats.turnsUsed,
        sceneId: currentScene.sceneId,
        userQuery: parsed.data.userInput,
        resolvedAvenueId: null,
        narration: narration.text,
        pointsDelta: 0
      });
      await session.save();
      endTrace(traceId, { status: session.status, routeType: 'clarification' });
      return res.json({
        session,
        currentScene,
        resolution: {
          type: 'clarification',
          selectedAvenueId: null,
          wildcardMode: null,
          confidence: classified.confidence || 0.45,
          explanation: wildcardDecision.reason,
          narration: narration.text,
          providerResponse: classified.providerResponse,
          traceId
        }
      });
    }

    resolutionType = 'wildcard';
    destinationSceneId = wildcardDecision.destinationSceneId;
    pointsDelta = wildcardDecision.pointsDelta;
    wildcardMode = wildcardDecision.mode;
    explanation = wildcardDecision.explanation;
  } else {
    selectedAvenue =
      currentScene.avenues.find((a) => a.avenueId === classified.avenueId) || currentScene.avenues[0];
    destinationSceneId = selectedAvenue.nextSceneId;
    pointsDelta = selectedAvenue.points;
    explanation = classified.explanation || `Mapped to authored route ${selectedAvenue.label}`;
  }

  session.stats.points += pointsDelta;
  session.stats.turnsUsed += 1;
  session.currentSceneId = destinationSceneId;

  const nextScene = game.scenes.find((scene) => scene.sceneId === destinationSceneId);
  const isTerminal = nextScene?.isTerminal || false;
  const maxTurnsReached = session.stats.turnsUsed >= game.constraints.maxTurns;

  if (isTerminal || maxTurnsReached) {
    session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
  }

  session.history.push({
    turn: session.stats.turnsUsed,
    sceneId: currentScene.sceneId,
    userQuery: parsed.data.userInput,
    resolvedAvenueId: selectedAvenue?.avenueId || null,
    narration: '',
    pointsDelta
  });

  const narration = await generateNarration({
    gameTitle: game.title,
    sceneNarrative: nextScene?.narrative || currentScene.narrative,
    playerInput: parsed.data.userInput,
    resolutionType,
    routeLabel: selectedAvenue?.label || wildcardMode || '',
    tone: parsed.data.tone
  });

  session.history[session.history.length - 1].narration = narration.text;

  await session.save();
  addSpan(traceId, 'state_update', {
    resolutionType,
    pointsDelta,
    destinationSceneId,
    status: session.status
  });
  endTrace(traceId, { status: session.status, routeType: resolutionType });

  return res.json({
    session,
    currentScene: nextScene,
    resolution: {
      type: resolutionType,
      selectedAvenueId: selectedAvenue?.avenueId || null,
      wildcardMode,
      confidence: classified.confidence || 0.5,
      explanation,
      narration: narration.text,
      providerResponse: classified.providerResponse,
      traceId
    }
  });
}

router.post('/action', actHandler);
router.post('/:sessionId/act', (req, _res, next) => {
  req.body = { ...req.body, sessionId: req.params.sessionId };
  return next();
}, actHandler);

export default router;
