import express from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { validatePublishability } from '../utils/validateGameTemplate.js';
import { ApiError } from '../errors/ApiError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  createGameSchema,
  generateFlowSchema,
  generateOptionsSchema
} from '../schemas/gameSchemas.js';
import { normalizeGameTemplate } from '../services/gameTemplateNormalizer.js';
import { generateGameFlow } from '../services/gameFlowGenerationService.js';
import { generateGameOptions } from '../services/gameOptionGenerationService.js';

const router = express.Router();

function getPagination(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
}

async function saveGameWithFallback(executor) {
  try {
    const mongoSession = await mongoose.startSession();
    try {
      let value = null;
      await mongoSession.withTransaction(async () => {
        value = await executor(mongoSession);
      });
      return value;
    } finally {
      await mongoSession.endSession();
    }
  } catch (error) {
    if (error.message.includes('Transaction numbers are only allowed on a replica set')) {
      return await executor(null);
    }
    throw error;
  }
}

router.get('/public', asyncHandler(async (_req, res) => {
  const { page, limit, skip } = getPagination(_req.query);
  const [games, total] = await Promise.all([
    GameTemplate.find({ status: 'public' }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    GameTemplate.countDocuments({ status: 'public' })
  ]);
  return res.json({ games: games.map(normalizeGameTemplate), pagination: { page, limit, total } });
}));

router.use(requireAuth);

router.get('/mine', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [games, total] = await Promise.all([
    GameTemplate.find({ adminId: req.user.id }).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    GameTemplate.countDocuments({ adminId: req.user.id })
  ]);
  return res.json({ games: games.map(normalizeGameTemplate), pagination: { page, limit, total } });
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_GAME_PAYLOAD', 'Invalid game payload', parsed.error.flatten());
  }

  const game = await saveGameWithFallback(async (mongoSession) => {
    const document = new GameTemplate({ ...parsed.data, adminId: req.user.id });
    await document.save(mongoSession ? { session: mongoSession } : undefined);
    return document;
  });
  return res.status(201).json({ game: normalizeGameTemplate(game) });
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }

  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_GAME_PAYLOAD', 'Invalid game payload', parsed.error.flatten());
  }
  const game = await saveGameWithFallback((mongoSession) => GameTemplate.findOneAndUpdate(
    { _id: req.params.id, adminId: req.user.id },
    { ...parsed.data, status: 'draft' },
    mongoSession ? { new: true, session: mongoSession } : { new: true }
  ));

  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  return res.json({ game: normalizeGameTemplate(game) });
}));

router.post('/generate-flow', requireRole('admin'), asyncHandler(async (req, res) => {
  const parsed = generateFlowSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_GENERATE_FLOW_PAYLOAD', 'Invalid flow payload', parsed.error.flatten());
  }

  const result = await generateGameFlow(parsed.data);
  const game = await saveGameWithFallback(async (mongoSession) => {
    const document = new GameTemplate({ ...result.game, adminId: req.user.id, status: 'draft' });
    await document.save(mongoSession ? { session: mongoSession } : undefined);
    return document;
  });

  return res.status(201).json({
    game: normalizeGameTemplate(game),
    generation: { success: result.success, error: result.error || '' }
  });
}));

router.post('/:id/regenerate-flow', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }
  const existing = await GameTemplate.findOne({ _id: req.params.id, adminId: req.user.id });
  if (!existing) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  const baseInput = {
    title: existing.title,
    description: existing.description,
    premise: existing.storyConfig?.premise || existing.description,
    startGoal: existing.storyConfig?.startGoal || existing.scenes[0]?.goalSummary || 'Begin the story',
    endGoal: existing.storyConfig?.endGoal || 'Reach a satisfying ending',
    tone: existing.storyConfig?.tone || 'cinematic',
    difficulty: existing.storyConfig?.difficulty || 'easy'
  };

  const result = await generateGameFlow(baseInput);
  const game = await saveGameWithFallback((mongoSession) => GameTemplate.findOneAndUpdate(
    { _id: req.params.id, adminId: req.user.id },
    { ...result.game, adminId: req.user.id, status: 'draft' },
    mongoSession ? { new: true, session: mongoSession } : { new: true }
  ));

  return res.json({
    game: normalizeGameTemplate(game),
    generation: { success: result.success, error: result.error || '' }
  });
}));

router.post('/:id/generate-options', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }
  const parsed = generateOptionsSchema.safeParse(req.body || {});
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_GENERATE_OPTIONS_PAYLOAD', 'Invalid options payload', parsed.error.flatten());
  }
  const existing = await GameTemplate.findOne({ _id: req.params.id, adminId: req.user.id });
  if (!existing) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }
  const result = await generateGameOptions(existing, parsed.data.sceneIds);
  const game = await saveGameWithFallback((mongoSession) => GameTemplate.findOneAndUpdate(
    { _id: req.params.id, adminId: req.user.id },
    { ...result.game, status: 'draft' },
    mongoSession ? { new: true, session: mongoSession } : { new: true }
  ));

  return res.json({
    game: normalizeGameTemplate(game),
    generation: {
      success: result.success,
      pendingSceneIds: normalizeGameTemplate(game).generationState.pendingSceneIds
    }
  });
}));

router.post('/:id/scenes/:sceneId/generate-options', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }
  const existing = await GameTemplate.findOne({ _id: req.params.id, adminId: req.user.id });
  if (!existing) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }
  const result = await generateGameOptions(existing, [req.params.sceneId]);
  const game = await saveGameWithFallback((mongoSession) => GameTemplate.findOneAndUpdate(
    { _id: req.params.id, adminId: req.user.id },
    { ...result.game, status: 'draft' },
    mongoSession ? { new: true, session: mongoSession } : { new: true }
  ));

  return res.json({
    game: normalizeGameTemplate(game),
    generation: {
      success: result.success,
      pendingSceneIds: normalizeGameTemplate(game).generationState.pendingSceneIds
    }
  });
}));

router.post('/:id/publish', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }

  const game = await saveGameWithFallback(async (mongoSession) => {
    const query = GameTemplate.findOne({ _id: req.params.id, adminId: req.user.id });
    const doc = mongoSession ? await query.session(mongoSession) : await query;
    if (!doc) {
      throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
    }

    const result = validatePublishability(doc);
    if (!result.ok) {
      throw new ApiError(400, 'GAME_NOT_PUBLISHABLE', 'Game is not publishable', result.errors);
    }

    doc.status = 'public';
    await doc.save(mongoSession ? { session: mongoSession } : undefined);
    return doc;
  });

  return res.json({ game: normalizeGameTemplate(game) });
}));

router.post('/generate', requireRole('admin'), asyncHandler(async (req, res) => {
  const parsed = generateFlowSchema.safeParse({
    title: req.body?.title,
    description: req.body?.description || '',
    premise: req.body?.story || req.body?.premise,
    startGoal: req.body?.startGoal || 'Begin the adventure',
    endGoal: req.body?.endGoal || 'Reach the ending',
    tone: req.body?.tone || 'cinematic',
    difficulty: req.body?.difficulty || 'easy'
  });
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_GENERATE_PAYLOAD', 'Invalid generate payload', parsed.error.flatten());
  }

  const flowResult = await generateGameFlow(parsed.data);
  const optionsResult = await generateGameOptions(flowResult.game);
  const game = await saveGameWithFallback(async (mongoSession) => {
    const document = new GameTemplate({ ...optionsResult.game, adminId: req.user.id, status: 'draft' });
    await document.save(mongoSession ? { session: mongoSession } : undefined);
    return document;
  });

  return res.status(201).json({
    game: normalizeGameTemplate(game),
    generation: {
      success: flowResult.success && optionsResult.success,
      pendingSceneIds: normalizeGameTemplate(game).generationState.pendingSceneIds
    }
  });
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'INVALID_GAME_ID', 'Invalid game id');
  }

  const game = await GameTemplate.findOneAndDelete({ _id: req.params.id, adminId: req.user.id });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  return res.json({ deleted: true, gameId: req.params.id });
}));

export default router;
