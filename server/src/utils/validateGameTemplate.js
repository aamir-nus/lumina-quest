function reachableSceneIds(startSceneId, byId) {
  const visited = new Set();
  const queue = [startSceneId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current) || !byId[current]) continue;
    visited.add(current);
    for (const avenue of byId[current].avenues || []) {
      queue.push(avenue.nextSceneId);
    }
  }

  return visited;
}

export function validatePublishability(game) {
  const errors = [];
  const byId = Object.fromEntries(game.scenes.map((scene) => [scene.sceneId, scene]));

  if (!byId[game.startSceneId]) {
    errors.push('startSceneId must exist in scenes');
  }

  if (game.constraints.maxTurns < 1) {
    errors.push('maxTurns must be greater than 0');
  }

  const terminals = game.scenes.filter((scene) => scene.isTerminal);
  if (terminals.length === 0) {
    errors.push('At least one terminal scene is required');
  }

  const reachables = reachableSceneIds(game.startSceneId, byId);
  if (reachables.size !== game.scenes.length) {
    errors.push('All scenes must be reachable from startSceneId');
  }

  const invalidEdges = [];
  for (const scene of game.scenes) {
    for (const avenue of scene.avenues || []) {
      if (!byId[avenue.nextSceneId]) {
        invalidEdges.push(`${scene.sceneId}.${avenue.avenueId}->${avenue.nextSceneId}`);
      }
    }
  }
  if (invalidEdges.length > 0) {
    errors.push(`Invalid avenue nextSceneId references: ${invalidEdges.join(', ')}`);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
