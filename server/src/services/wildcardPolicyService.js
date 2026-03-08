import { GAME } from '../constants/appConstants.js';

function buildAllowedDestinations({ currentScene, game }) {
  const avenues = currentScene.avenues || [];
  const uniqueAvenueDestinations = [...new Set(avenues.map((a) => a.nextSceneId).filter(Boolean))];

  const allowed = new Set([currentScene.sceneId, ...uniqueAvenueDestinations]);
  if (game.wildcardConfig?.recoverySceneId) allowed.add(game.wildcardConfig.recoverySceneId);

  return [...allowed].filter(Boolean);
}

function clampPoints(mode, game) {
  const high = Number(game.wildcardConfig?.highRewardPoints ?? 2);
  const low = Number(game.wildcardConfig?.lowRewardPoints ?? 0);

  if (mode === 'high-reward') return Math.max(0, Math.min(GAME.MAX_WILDCARD_HIGH_POINTS, high));
  return Math.max(GAME.MIN_WILDCARD_LOW_POINTS, Math.min(GAME.MAX_WILDCARD_LOW_POINTS, low));
}

export function evaluateWildcard({ game, currentScene, candidate }) {
  if (!game.wildcardConfig?.enabled) {
    return {
      approved: false,
      reason: 'wildcard_disabled',
      resolutionType: 'clarification'
    };
  }

  const allowedDestinations = buildAllowedDestinations({ currentScene, game });
  const requested = candidate?.destinationSceneId || '';
  const destinationSceneId = allowedDestinations.includes(requested)
    ? requested
    : allowedDestinations[0] || currentScene.sceneId;

  const mode = candidate?.mode === 'high-reward' ? 'high-reward' : 'low-reward';

  return {
    approved: true,
    resolutionType: 'wildcard',
    mode,
    pointsDelta: clampPoints(mode, game),
    destinationSceneId,
    explanation:
      candidate?.explanation ||
      'Input did not strongly match authored avenues, so a bounded wildcard bridge was applied.',
    allowedDestinations
  };
}
