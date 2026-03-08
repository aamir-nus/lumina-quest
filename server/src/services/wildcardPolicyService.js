function buildAllowedDestinations({ currentScene, game }) {
  const avenues = currentScene.avenues || [];
  const firstAvenueDest = avenues[0]?.nextSceneId;
  const uniqueAvenueDestinations = [...new Set(avenues.map((a) => a.nextSceneId))];

  const allowed = new Set([currentScene.sceneId, ...uniqueAvenueDestinations]);
  if (firstAvenueDest) allowed.add(firstAvenueDest);
  if (game.wildcardConfig?.recoverySceneId) allowed.add(game.wildcardConfig.recoverySceneId);

  return [...allowed].filter(Boolean);
}

function clampPoints(mode, game) {
  const high = Number(game.wildcardConfig?.highRewardPoints ?? 2);
  const low = Number(game.wildcardConfig?.lowRewardPoints ?? 0);

  if (mode === 'high-reward') return Math.max(0, Math.min(5, high));
  return Math.max(-2, Math.min(2, low));
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
