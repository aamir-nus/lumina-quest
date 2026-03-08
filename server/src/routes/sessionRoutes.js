import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ApiError } from '../errors/ApiError.js';
import {
  getSessionHistory,
  getSessionSnapshot,
  processSessionAction,
  startSessionForUser
} from '../services/sessionEngineService.js';

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
  if (!mongoose.isValidObjectId(parsed.data.gameId)) throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid gameId');

  const session = await startSessionForUser({ userId: req.user.id, gameId: parsed.data.gameId });
  return res.status(201).json({ session });
}));

router.get('/:sessionId', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sessionId)) {
    throw new ApiError(400, 'INVALID_SESSION_ID', 'Invalid sessionId');
  }

  const result = await getSessionSnapshot({ userId: req.user.id, sessionId: req.params.sessionId });
  return res.json(result);
}));

router.get('/:sessionId/history', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sessionId)) {
    throw new ApiError(400, 'INVALID_SESSION_ID', 'Invalid sessionId');
  }

  const history = await getSessionHistory({ userId: req.user.id, sessionId: req.params.sessionId });
  return res.json({ history });
}));

const actHandler = asyncHandler(async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Invalid payload');
  if (!mongoose.isValidObjectId(parsed.data.sessionId)) {
    throw new ApiError(400, 'INVALID_SESSION_ID', 'Invalid sessionId');
  }

  const result = await processSessionAction({ userId: req.user.id, payload: parsed.data });
  return res.json(result);
});

router.post('/action', actHandler);
router.post('/:sessionId/act', (req, _res, next) => {
  req.body = { ...req.body, sessionId: req.params.sessionId };
  return next();
}, actHandler);

export default router;
