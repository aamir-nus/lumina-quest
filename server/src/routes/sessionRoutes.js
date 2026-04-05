import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../errors/ApiError.js';
import { llmActionRateLimiter } from '../middleware/security.js';
import {
  getSessionHistory,
  getSessionSnapshot,
  processSessionAction,
  startSessionForUser
} from '../services/sessionEngineService.js';
import { generateWizardDialogue } from '../services/llmResolver.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { GameTemplate } from '../models/GameTemplate.js';

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

router.post('/start', asyncHandler(async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Invalid payload');

  const session = await startSessionForUser({ userId: req.user.id, gameId: parsed.data.gameId });
  return res.status(201).json({ session });
}));

router.get('/:sessionId', asyncHandler(async (req, res) => {
  const result = await getSessionSnapshot({ userId: req.user.id, sessionId: req.params.sessionId });
  return res.json(result);
}));

router.get('/:sessionId/history', asyncHandler(async (req, res) => {
  const history = await getSessionHistory({ userId: req.user.id, sessionId: req.params.sessionId });
  return res.json({ history });
}));

const actHandler = asyncHandler(async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Invalid payload');

  const result = await processSessionAction({ userId: req.user.id, payload: parsed.data });
  return res.json(result);
});

router.post('/action', llmActionRateLimiter, actHandler);

router.post('/:sessionId/wizard-dialogue', asyncHandler(async (req, res) => {
  const session = await PlayerSession.findOne({ _id: req.params.sessionId, userId: req.user.id });
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');

  if (session.status === 'active') {
    throw new ApiError(400, 'SESSION_ACTIVE', 'Session must be completed to get ending dialogue');
  }

  const game = await GameTemplate.findById(session.gameId);
  if (!game) throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');

  // Calculate grade
  const score = session.stats.points;
  const target = game.constraints.targetPoints;
  let grade;
  if (session.status === 'won' && score >= target + 3) grade = 'S';
  else if (session.status === 'won' && score >= target) grade = 'A';
  else if (session.status === 'won') grade = 'B';
  else if (score >= target - 1) grade = 'C';
  else grade = 'D';

  const result = await generateWizardDialogue({
    gameTitle: game.title,
    grade,
    points: session.stats.points,
    targetPoints: game.constraints.targetPoints,
    turnsUsed: session.stats.turnsUsed,
    maxTurns: game.constraints.maxTurns,
    status: session.status,
    choices: session.history || []
  });

  return res.json({
    dialogue: result.dialogue,
    grade,
    usage: result.usage
  });
}));

export default router;
