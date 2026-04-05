import { ApiError } from '../errors/ApiError.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { generateNarration } from './llmResolver.js';
import { addSpan, endTrace, startTrace } from './traceService.js';
import { normalizeGameTemplate } from './gameTemplateNormalizer.js';
import { resolveSceneInput } from './sessionInputResolver.js';
import {
  applyInvalidAttempt,
  buildDiegeticFailureMessage,
  getInvalidAttemptState,
  resetInvalidAttempts
} from './sessionFailurePolicy.js';
import { logger } from '../utils/logger.js';

function baseVisualStateFromScene(scene) {
  const render = scene?.renderConfig || {};
  return {
    theme: render.theme || 'pastel',
    activeLayers: [...(render.backgroundLayers || []), ...(render.foregroundLayers || [])],
    spriteMood: render.sprite?.mood || 'neutral',
    transition: 'fade'
  };
}

function applyVisualEffects(baseState, avenue) {
  const effects = avenue?.visualEffects || {};
  const layers = new Set(baseState.activeLayers || []);

  for (const layer of effects.enableLayers || []) layers.add(layer);
  for (const layer of effects.disableLayers || []) layers.delete(layer);

  return {
    ...baseState,
    theme: effects.setTheme || baseState.theme,
    spriteMood: effects.spriteMood || baseState.spriteMood,
    transition: effects.transition || 'fade',
    activeLayers: [...layers]
  };
}

function mergeUsage(...items) {
  return items.reduce(
    (acc, usage) => {
      if (!usage) return acc;
      acc.inputTokens += Number(usage.inputTokens || 0);
      acc.outputTokens += Number(usage.outputTokens || 0);
      acc.totalTokens += Number(usage.totalTokens || 0);
      return acc;
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
}

function mergeCompute(...items) {
  const valid = items.filter(Boolean);
  if (valid.length === 0) return null;
  return {
    latencyMs: valid.reduce((a, b) => a + Number(b.latencyMs || 0), 0),
    cpuUserMs: valid.reduce((a, b) => a + Number(b.cpuUserMs || 0), 0),
    cpuSystemMs: valid.reduce((a, b) => a + Number(b.cpuSystemMs || 0), 0),
    rssMb: Math.max(...valid.map((b) => Number(b.rssMb || 0))),
    heapUsedMb: Math.max(...valid.map((b) => Number(b.heapUsedMb || 0)))
  };
}

async function saveSessionOrThrowConflict(session) {
  try {
    await session.save();
  } catch (error) {
    if (error?.name === 'VersionError') {
      throw new ApiError(409, 'SESSION_CONFLICT', 'Session was updated by another action. Retry your move.');
    }
    throw error;
  }
}

/**
 * Create a new player session from a published game template.
 */
export async function startSessionForUser({ userId, gameId }) {
  const gameDoc = await GameTemplate.findOne({ _id: gameId, status: 'public' });
  if (!gameDoc) throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found or not public');
  const game = normalizeGameTemplate(gameDoc);
  const startScene = game.scenes.find((scene) => scene.sceneId === game.startSceneId);

  const session = await PlayerSession.create({
    userId,
    gameId: gameDoc._id,
    currentSceneId: game.startSceneId,
    stats: { points: 0, turnsUsed: 0 },
    visualState: baseVisualStateFromScene(startScene),
    history: []
  });

  return session;
}

/**
 * Return session, game, and current-scene snapshot for the player.
 */
export async function getSessionSnapshot({ userId, sessionId }) {
  const session = await PlayerSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');

  const game = normalizeGameTemplate(await GameTemplate.findById(session.gameId).lean());
  const currentScene = game?.scenes?.find((scene) => scene.sceneId === session.currentSceneId) || null;

  return { session, game, currentScene };
}

/**
 * Return persisted session turn history for replay UI.
 */
export async function getSessionHistory({ userId, sessionId }) {
  const session = await PlayerSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
  return session.history || [];
}

function resolveTerminal(session, game, traceId) {
  session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
  addSpan(traceId, 'terminal_resolution', { status: session.status });
  endTrace(traceId, { status: session.status });
}

/* process one player action and persist deterministic game state changes. */
export async function processSessionAction({ userId, payload }) {
  logger.info('[GAME_ENGINE] 🎮 Processing action...', { userInput: payload.userInput });

  const session = await PlayerSession.findOne({ _id: payload.sessionId, userId });
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (session.status !== 'active') {
    throw new ApiError(409, 'SESSION_FINISHED', 'Session already finished', { status: session.status });
  }

  const gameDoc = await GameTemplate.findById(session.gameId);
  if (!gameDoc) throw new ApiError(404, 'GAME_NOT_FOUND', 'Game for session no longer exists');
  const game = normalizeGameTemplate(gameDoc);

  logger.info('[GAME_ENGINE] 🎲 Game state', { gameTitle: game.title, turn: session.stats.turnsUsed + 1 });

  const currentScene = game.scenes.find((scene) => scene.sceneId === session.currentSceneId);
  const traceId = startTrace('session_action', {
    sessionId: session._id.toString(),
    gameId: game._id.toString()
  });

  if (!currentScene || currentScene.isTerminal || currentScene.avenues.length === 0) {
    logger.info('[GAME_ENGINE] 🏁 Terminal state reached');
    resolveTerminal(session, game, traceId);
    await saveSessionOrThrowConflict(session);
    return {
      session,
      resolution: {
        narration: 'This story branch is complete.',
        selectedAvenueId: null,
        reason: 'terminal_or_no_moves',
        type: 'clarification',
        confidence: 1,
        explanation: 'Session reached a terminal state.'
      }
    };
  }

  logger.info('[GAME_ENGINE] 📍 Current Scene', { sceneId: currentScene.sceneId });

  const classified = await resolveSceneInput({
    game,
    currentScene,
    sessionHistory: session.history,
    userInput: payload.userInput
  });
  addSpan(traceId, 'classification', { routeType: classified.routeType, confidence: classified.confidence });

  // Only 'avenue' route type means successful match to authored option
  // 'no_match' or 'clarification' means input couldn't be mapped → invalid attempt
  if (classified.routeType !== 'avenue') {
    const invalid = applyInvalidAttempt({ session, scene: currentScene });
    const narration = buildDiegeticFailureMessage({ lost: invalid.lost, remaining: invalid.remaining });

    session.stats.turnsUsed += 1;
    session.history.push({
      turn: session.stats.turnsUsed,
      sceneId: currentScene.sceneId,
      userQuery: payload.userInput,
      resolvedAvenueId: null,
      matchedBy: 'none',
      resolutionType: 'invalid',
      destinationSceneId: currentScene.sceneId,
      invalidAttemptCount: invalid.nextCount,
      narration,
      pointsDelta: invalid.penalty
    });

    await saveSessionOrThrowConflict(session);
    addSpan(traceId, 'invalid_attempt', invalid);
    endTrace(traceId, { status: session.status, routeType: 'invalid' });

    return {
      session,
      currentScene,
      resolution: {
        type: 'invalid',
        matchedBy: 'none',
        selectedAvenueId: null,
        wildcardMode: null,
        confidence: classified.confidence || 0,
        explanation: classified.explanation || 'Input did not match any authored route.',
        narration,
        invalidAttemptsRemaining: invalid.remaining,
        endReason: session.endReason || '',
        providerResponse: classified.providerResponse,
        llm: {
          provider: classified.provider || 'unknown',
          tokens: mergeUsage(classified.usage),
          computeApprox: mergeCompute(classified.computeApprox)
        },
        traceId
      }
    };
  }

  // Successful match to authored route
  const resolutionType = 'avenue';
  const selectedAvenue =
    currentScene.avenues.find((avenue) => avenue.avenueId === classified.avenueId) || currentScene.avenues[0];
  const destinationSceneId = selectedAvenue.nextSceneId;
  const pointsDelta = selectedAvenue.scoreImpact ?? selectedAvenue.points;
  const explanation = classified.explanation || `Mapped to authored route ${selectedAvenue.label}`;

  // Reset invalid attempts on successful action
  resetInvalidAttempts(session, currentScene.sceneId);
  session.stats.points += pointsDelta;
  session.stats.turnsUsed += 1;
  session.currentSceneId = destinationSceneId;

  logger.info('[GAME_ENGINE] ➡️  Resolution', { resolutionType, destinationSceneId, pointsDelta, matchedBy: classified.matchedBy });

  const nextScene = game.scenes.find((scene) => scene.sceneId === destinationSceneId);
  const nextVisualBase = baseVisualStateFromScene(nextScene || currentScene);
  session.visualState = applyVisualEffects(nextVisualBase, selectedAvenue);
  if (nextScene?.isTerminal || session.stats.turnsUsed >= game.constraints.maxTurns) {
    session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
    logger.info('[GAME_ENGINE] 🏁 Game finished', { status: session.status.toUpperCase(), points: session.stats.points, targetPoints: game.constraints.targetPoints });
  }

  session.history.push({
    turn: session.stats.turnsUsed,
    sceneId: currentScene.sceneId,
    userQuery: payload.userInput,
    resolvedAvenueId: selectedAvenue?.avenueId || null,
    matchedBy: classified.matchedBy || (resolutionType === 'wildcard' ? 'wildcard' : 'llm'),
    resolutionType,
    destinationSceneId,
    invalidAttemptCount: 0,
    narration: '',
    pointsDelta
  });

  // Skip LLM narration for direct/normalized/deterministic matches - use simple transition
  const isDirectMatch = classified.matchedBy === 'direct_selection' || classified.matchedBy === 'direct' || classified.matchedBy === 'normalized';
  let narration;
  if (isDirectMatch) {
    logger.info('[GAME_ENGINE] ⚡ Skipping LLM narration for direct match', { matchedBy: classified.matchedBy });
    narration = {
      text: nextScene?.narrative || currentScene.narrative,
      provider: 'deterministic',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    };
  } else {
    narration = await generateNarration({
      gameTitle: game.title,
      sceneNarrative: nextScene?.narrative || currentScene.narrative,
      playerInput: payload.userInput,
      resolutionType,
      routeLabel: selectedAvenue?.label || '',
      tone: payload.tone
    });
  }

  session.history[session.history.length - 1].narration = narration.text;
  await saveSessionOrThrowConflict(session);

  logger.info('[GAME_ENGINE] 💾 Session saved', { status: session.status, points: session.stats.points });

  addSpan(traceId, 'state_update', {
    resolutionType,
    pointsDelta,
    destinationSceneId,
    status: session.status
  });
  endTrace(traceId, { status: session.status, routeType: resolutionType });

  return {
    session,
    currentScene: nextScene,
    resolution: {
      type: resolutionType,
      matchedBy: classified.matchedBy || 'llm',
      selectedAvenueId: selectedAvenue?.avenueId || null,
      wildcardMode: null,
      confidence: classified.confidence || 0.5,
      explanation,
      narration: narration.text,
      invalidAttemptsRemaining: getInvalidAttemptState(
        session,
        currentScene.sceneId,
        currentScene.inputPolicy?.invalidAttemptLimit ?? 3
      ).remaining,
      endReason: session.endReason || '',
      providerResponse: classified.providerResponse,
      llm: {
        provider: classified.provider || narration.provider || 'unknown',
        tokens: mergeUsage(classified.usage, narration.usage),
        computeApprox: mergeCompute(classified.computeApprox, narration.computeApprox)
      },
      traceId
    }
  };
}
