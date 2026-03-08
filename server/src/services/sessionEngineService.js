import { ApiError } from '../errors/ApiError.js';
import { GameTemplate } from '../models/GameTemplate.js';
import { PlayerSession } from '../models/PlayerSession.js';
import { classifyRoute, generateNarration } from './llmResolver.js';
import { evaluateWildcard } from './wildcardPolicyService.js';
import { addSpan, endTrace, startTrace } from './traceService.js';

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

export async function startSessionForUser({ userId, gameId }) {
  const game = await GameTemplate.findOne({ _id: gameId, status: 'public' });
  if (!game) throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found or not public');
  const startScene = game.scenes.find((scene) => scene.sceneId === game.startSceneId);

  const session = await PlayerSession.create({
    userId,
    gameId: game._id,
    currentSceneId: game.startSceneId,
    stats: { points: 0, turnsUsed: 0 },
    visualState: baseVisualStateFromScene(startScene),
    history: []
  });

  return session;
}

export async function getSessionSnapshot({ userId, sessionId }) {
  const session = await PlayerSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');

  const game = await GameTemplate.findById(session.gameId).lean();
  const currentScene = game?.scenes?.find((scene) => scene.sceneId === session.currentSceneId) || null;

  return { session, game, currentScene };
}

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

async function resolveClarification({ session, game, currentScene, payload, classified, traceId }) {
  const narration = await generateNarration({
    gameTitle: game.title,
    sceneNarrative: currentScene.narrative,
    playerInput: payload.userInput,
    resolutionType: 'clarification',
    routeLabel: '',
    tone: payload.tone
  });

  session.stats.turnsUsed += 1;
  const maxTurnsReached = session.stats.turnsUsed >= game.constraints.maxTurns;
  if (maxTurnsReached) {
    session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
  }

  session.history.push({
    turn: session.stats.turnsUsed,
    sceneId: currentScene.sceneId,
    userQuery: payload.userInput,
    resolvedAvenueId: null,
    narration: narration.text,
    pointsDelta: 0
  });
  session.visualState.transition = 'pulse';

  await session.save();
  addSpan(traceId, 'clarification', { maxTurnsReached });
  endTrace(traceId, { status: session.status, routeType: 'clarification' });

  return {
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
  };
}

export async function processSessionAction({ userId, payload }) {
  const session = await PlayerSession.findOne({ _id: payload.sessionId, userId });
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
  if (session.status !== 'active') {
    throw new ApiError(409, 'SESSION_FINISHED', 'Session already finished', { status: session.status });
  }

  const game = await GameTemplate.findById(session.gameId);
  if (!game) throw new ApiError(404, 'GAME_NOT_FOUND', 'Game for session no longer exists');

  const currentScene = game.scenes.find((scene) => scene.sceneId === session.currentSceneId);
  const traceId = startTrace('session_action', {
    sessionId: session._id.toString(),
    gameId: game._id.toString()
  });

  if (!currentScene || currentScene.isTerminal || currentScene.avenues.length === 0) {
    resolveTerminal(session, game, traceId);
    await session.save();
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

  const classified = await classifyRoute({
    gameTitle: game.title,
    sceneNarrative: currentScene.narrative,
    input: payload.userInput,
    avenues: currentScene.avenues,
    history: session.history,
    wildcardEnabled: Boolean(game.wildcardConfig?.enabled)
  });
  addSpan(traceId, 'classification', { routeType: classified.routeType, confidence: classified.confidence });

  if (classified.routeType === 'clarification') {
    return resolveClarification({ session, game, currentScene, payload, classified, traceId });
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
      return resolveClarification({
        session,
        game,
        currentScene,
        payload,
        classified: {
          ...classified,
          explanation: wildcardDecision.reason
        },
        traceId
      });
    }

    resolutionType = 'wildcard';
    destinationSceneId = wildcardDecision.destinationSceneId;
    pointsDelta = wildcardDecision.pointsDelta;
    wildcardMode = wildcardDecision.mode;
    explanation = wildcardDecision.explanation;
  } else {
    selectedAvenue =
      currentScene.avenues.find((avenue) => avenue.avenueId === classified.avenueId) || currentScene.avenues[0];
    destinationSceneId = selectedAvenue.nextSceneId;
    pointsDelta = selectedAvenue.points;
    explanation = classified.explanation || `Mapped to authored route ${selectedAvenue.label}`;
  }

  session.stats.points += pointsDelta;
  session.stats.turnsUsed += 1;
  session.currentSceneId = destinationSceneId;

  const nextScene = game.scenes.find((scene) => scene.sceneId === destinationSceneId);
  const nextVisualBase = baseVisualStateFromScene(nextScene || currentScene);
  session.visualState = applyVisualEffects(nextVisualBase, selectedAvenue);
  if (resolutionType === 'wildcard') {
    session.visualState.transition = wildcardMode === 'high-reward' ? 'arcade-flash' : 'scanline';
  }
  if (nextScene?.isTerminal || session.stats.turnsUsed >= game.constraints.maxTurns) {
    session.status = session.stats.points >= game.constraints.targetPoints ? 'won' : 'lost';
  }

  session.history.push({
    turn: session.stats.turnsUsed,
    sceneId: currentScene.sceneId,
    userQuery: payload.userInput,
    resolvedAvenueId: selectedAvenue?.avenueId || null,
    narration: '',
    pointsDelta
  });

  const narration = await generateNarration({
    gameTitle: game.title,
    sceneNarrative: nextScene?.narrative || currentScene.narrative,
    playerInput: payload.userInput,
    resolutionType,
    routeLabel: selectedAvenue?.label || wildcardMode || '',
    tone: payload.tone
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

  return {
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
  };
}
