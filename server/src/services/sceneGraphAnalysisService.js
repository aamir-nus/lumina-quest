import { GAME } from '../constants/appConstants.js';
import { normalizeGameTemplate } from './gameTemplateNormalizer.js';

function bySceneId(game) {
  return Object.fromEntries((game.scenes || []).map((scene) => [scene.sceneId, scene]));
}

function reachableFromStart(game) {
  const byId = bySceneId(game);
  const visited = new Set();
  const queue = [game.startSceneId];

  while (queue.length > 0) {
    const id = queue.shift();
    const scene = byId[id];
    if (!scene || visited.has(id)) continue;
    visited.add(id);
    for (const avenue of scene.avenues || []) {
      queue.push(avenue.nextSceneId);
    }
  }

  return visited;
}

function calcTurnEconomy(game) {
  const byId = bySceneId(game);
  const terminals = new Set((game.scenes || []).filter((s) => s.isTerminal).map((s) => s.sceneId));

  let minTurns = Infinity;
  let maxTurns = 0;

  function dfs(sceneId, turns, seen) {
    if (turns > game.constraints.maxTurns + GAME.TURN_SEARCH_BUFFER) return;
    if (terminals.has(sceneId)) {
      minTurns = Math.min(minTurns, turns);
      maxTurns = Math.max(maxTurns, turns);
      return;
    }

    const scene = byId[sceneId];
    if (!scene || seen.has(sceneId)) return;

    const nextSeen = new Set(seen);
    nextSeen.add(sceneId);
    for (const avenue of scene.avenues || []) {
      dfs(avenue.nextSceneId, turns + 1, nextSeen);
    }
  }

  dfs(game.startSceneId, 0, new Set());

  return {
    minimumTurnsToEnding: Number.isFinite(minTurns) ? minTurns : null,
    maximumTurnsToEnding: maxTurns || null
  };
}

function calcPointBounds(game) {
  const byId = bySceneId(game);
  const terminals = new Set((game.scenes || []).filter((s) => s.isTerminal).map((s) => s.sceneId));

  let minPoints = Infinity;
  let maxPoints = -Infinity;

  function dfs(sceneId, points, seen) {
    if (seen.size > game.constraints.maxTurns + GAME.TURN_SEARCH_BUFFER) return;
    if (terminals.has(sceneId)) {
      minPoints = Math.min(minPoints, points);
      maxPoints = Math.max(maxPoints, points);
      return;
    }

    const scene = byId[sceneId];
    if (!scene || seen.has(sceneId)) return;

    const nextSeen = new Set(seen);
    nextSeen.add(sceneId);
    for (const avenue of scene.avenues || []) {
      dfs(avenue.nextSceneId, points + avenue.points, nextSeen);
    }
  }

  dfs(game.startSceneId, 0, new Set());

  return {
    minAchievablePoints: Number.isFinite(minPoints) ? minPoints : null,
    maxAchievablePoints: Number.isFinite(maxPoints) ? maxPoints : null,
    targetPoints: game.constraints.targetPoints,
    isLikelyBalanced:
      Number.isFinite(minPoints) && Number.isFinite(maxPoints)
        ? game.constraints.targetPoints >= minPoints && game.constraints.targetPoints <= maxPoints
        : false
  };
}

/**
 * Analyze reachability, point-balance, and turn economy of an authored game graph.
 */
export function analyzeGameGraph(game) {
  const normalized = normalizeGameTemplate(game);
  const allSceneIds = new Set((normalized.scenes || []).map((scene) => scene.sceneId));
  const reachable = reachableFromStart(normalized);
  const unreachableScenes = [...allSceneIds].filter((id) => !reachable.has(id));
  const deadEnds = (normalized.scenes || [])
    .filter((scene) => !scene.isTerminal && (scene.avenues || []).length === 0)
    .map((scene) => scene.sceneId);
  const endings = (normalized.scenes || []).filter((scene) => scene.kind === 'ending' || scene.isTerminal);

  return {
    reachability: { unreachableScenes, deadEnds },
    balance: calcPointBounds(normalized),
    turnEconomy: calcTurnEconomy(normalized),
    endings: {
      win: endings.filter((scene) => (scene.endingType || 'win') === 'win').map((scene) => scene.sceneId),
      fail: endings.filter((scene) => scene.endingType === 'fail').map((scene) => scene.sceneId)
    }
  };
}
