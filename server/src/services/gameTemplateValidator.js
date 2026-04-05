import { normalizeGameTemplate } from './gameTemplateNormalizer.js';
import { getExpectedOptionRange } from './optionCountGenerator.js';
import { logger } from '../utils/logger.js';

function expectedOptionRange(difficulty = 'easy') {
  const range = getExpectedOptionRange(difficulty);
  return { min: range.min, max: range.max, default: range.min };
}

function bySceneId(game) {
  return Object.fromEntries((game.scenes || []).map((scene) => [scene.sceneId, scene]));
}

function reachableFromStart(game) {
  const byId = bySceneId(game);
  const visited = new Set();
  const queue = [game.startSceneId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current) || !byId[current]) continue;
    visited.add(current);
    for (const avenue of byId[current].avenues || []) {
      queue.push(avenue.nextSceneId);
    }
  }

  return visited;
}

function expectedOptionCount(difficulty = 'easy') {
  if (difficulty === 'hard') return { min: 1, max: 6 };
  if (difficulty === 'medium') return { min: 1, max: 5 };
  return { min: 1, max: 3 };
}

function isTerminalEnding(scene) {
  return scene.kind === 'ending' || scene.isTerminal;
}

export function validateGameTemplate(input, { mode = 'draft' } = {}) {
  const game = normalizeGameTemplate(input);
  const errors = [];
  const warnings = [];
  const byId = bySceneId(game);
  const reachables = reachableFromStart(game);

  if (!byId[game.startSceneId]) {
    errors.push('startSceneId must exist in scenes');
  }

  if ((game.constraints?.maxTurns || 0) < 1) {
    errors.push('constraints.maxTurns must be greater than 0');
  }

  const winEndings = game.scenes.filter((scene) => isTerminalEnding(scene) && (scene.endingType || 'win') === 'win');
  if (winEndings.length === 0) {
    errors.push('At least one win ending is required');
  }

  if (reachables.size !== game.scenes.length) {
    warnings.push('Some scenes are unreachable from startSceneId');
    if (mode === 'publish') {
      errors.push('All scenes must be reachable from startSceneId');
    }
  }

  for (const scene of game.scenes) {
    for (const avenue of scene.avenues || []) {
      if (!byId[avenue.nextSceneId]) {
        errors.push(`Invalid avenue nextSceneId reference: ${scene.sceneId}.${avenue.avenueId}->${avenue.nextSceneId}`);
      }
    }
  }

  // V2-only validation
  const starts = game.scenes.filter((scene) => scene.kind === 'start');
  const beats = game.scenes.filter((scene) => scene.kind === 'beat');

  if (starts.length !== 1) {
    errors.push('Exactly one start scene is required');
  }
  if (beats.length < 3 || beats.length > 10) {
    errors.push('Games require 3-10 beat scenes');
  }

  for (const scene of game.scenes) {
    if (scene.kind !== 'ending' && !scene.isTerminal) {
      if (!scene.inputPolicy) {
        errors.push(`Scene ${scene.sceneId} is missing inputPolicy`);
      }

      const avenueCount = (scene.avenues || []).length;
      if (mode === 'publish') {
        const { min, max } = expectedOptionRange(game.storyConfig?.difficulty);
        if (avenueCount < min) {
          errors.push(`Scene ${scene.sceneId} must have at least ${min} options for ${game.storyConfig?.difficulty || 'easy'} difficulty`);
        }
        if (avenueCount > max) {
          errors.push(`Scene ${scene.sceneId} can have at most ${max} options for ${game.storyConfig?.difficulty || 'easy'} difficulty`);
        }
      } else if (avenueCount > 0) {
        const { min, max } = expectedOptionRange(game.storyConfig?.difficulty);
        if (avenueCount < min) {
          warnings.push(`Scene ${scene.sceneId} currently has ${avenueCount} options; at least ${min} recommended`);
        }
        if (avenueCount > max) {
          warnings.push(`Scene ${scene.sceneId} currently has ${avenueCount} options; at most ${max} recommended`);
        }
      }
    }
  }

  logger.info('[TEMPLATE_V2] validate', {
    title: game.title,
    mode,
    errors: errors.length,
    warnings: warnings.length
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized: game
  };
}

export function getExpectedOptionCount(difficulty) {
  return expectedOptionRange(difficulty).default;
}
