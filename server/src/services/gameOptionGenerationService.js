import { buildGameOptionPrompt } from './promptBuilders/gameOptionPromptBuilder.js';
import { createDebugEntry, makeAvenueId } from './gameGenerationSupport.js';
import { normalizeGameTemplate } from './gameTemplateNormalizer.js';
import { validateGameTemplate } from './gameTemplateValidator.js';
import { createLmStudioClient, getLmStudioModel, parseJsonResponse, withLlmTimeout } from './lmStudioService.js';
import { generateOptionCounts } from './optionCountGenerator.js';
import { logger } from '../utils/logger.js';

const MAX_ATTEMPTS = 3;

function findDefaultFailScene(game) {
  return game.scenes.find((scene) => scene.kind === 'ending' && scene.endingType === 'fail')
    || game.scenes.find((scene) => scene.kind === 'ending')
    || null;
}

function findNextSuccessScene(game, scene) {
  const beats = game.scenes.filter((item) => item.kind === 'beat').sort((a, b) => a.stepIndex - b.stepIndex);
  const currentBeatIndex = beats.findIndex((item) => item.sceneId === scene.sceneId);
  if (scene.kind === 'start') {
    return beats[0] || game.scenes.find((item) => item.kind === 'ending' && item.endingType === 'win') || null;
  }
  if (currentBeatIndex >= 0 && beats[currentBeatIndex + 1]) {
    return beats[currentBeatIndex + 1];
  }
  return game.scenes.find((item) => item.kind === 'ending' && item.endingType === 'win')
    || game.scenes.find((item) => item.kind === 'ending')
    || null;
}

function coerceOptions(payload, sceneId, allowedSceneIds, fallbackNextSceneId, fallbackFailSceneId, optionCount, origin = 'ai_generated') {
  const options = Array.isArray(payload.options) ? payload.options : [];
  return options.slice(0, optionCount).map((option, index) => {
    const nextSceneId = allowedSceneIds.has(option.nextSceneId)
      ? option.nextSceneId
      : index === 0
        ? fallbackNextSceneId
        : fallbackFailSceneId || fallbackNextSceneId;
    const scoreImpact = Number.isFinite(option.scoreImpact) ? option.scoreImpact : Number(option.points ?? 0);
    return {
      avenueId: option.avenueId || makeAvenueId(sceneId, index),
      label: String(option.label || `Option ${index + 1}`).slice(0, 100),
      intent: String(option.intent || option.label || `Intent ${index + 1}`).slice(0, 180),
      outcome: option.outcome === 'success' || option.outcome === 'fail' ? option.outcome : 'partial',
      keywords: Array.isArray(option.keywords) ? option.keywords.map((value) => String(value).slice(0, 40)) : [],
      scoreImpact,
      points: scoreImpact,
      nextSceneId,
      origin,
      visualEffects: {
        transition: 'fade',
        spriteMood: '',
        setTheme: '',
        enableLayers: [],
        disableLayers: []
      }
    };
  });
}

function applySceneOptions(game, sceneId, avenues) {
  return {
    ...game,
    scenes: game.scenes.map((scene) => (
      scene.sceneId === sceneId
        ? { ...scene, avenues }
        : scene
    ))
  };
}

function updateGenerationState(game, pendingSceneIds, debug, status, lastError = '') {
  return {
    ...game,
    generationState: {
      ...(game.generationState || {}),
      status,
      pendingSceneIds,
      debug,
      lastError
    }
  };
}

async function generateOptionsForScene({ client, model, game, scene }) {
  const difficulty = game.storyConfig?.difficulty || 'easy';
  const optionCounts = generateOptionCounts(difficulty);
  const nextScene = findNextSuccessScene(game, scene);
  const failScene = findDefaultFailScene(game);
  const allowedSceneIds = new Set([nextScene?.sceneId, failScene?.sceneId].filter(Boolean));

  logger.info('[OPTION_GEN] generated counts', {
    sceneId: scene.sceneId,
    difficulty,
    ...optionCounts
  });

  const prompt = buildGameOptionPrompt({
    title: game.title,
    premise: game.storyConfig?.premise || game.description,
    tone: game.storyConfig?.tone || 'cinematic',
    difficulty,
    currentScene: scene,
    nextScene,
    failScene,
    optionCounts
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      logger.info('[OPTION_GEN] attempt', { sceneId: scene.sceneId, attempt, model });
      const response = await withLlmTimeout(
        client.responses.create({
          model,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: 'Generate authored options for the current story beat only.' }]
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }]
            }
          ]
        }),
        50000,
        `option_generation_${scene.sceneId}`
      );

      const parsed = parseJsonResponse(response, {});
      const avenues = coerceOptions(
        parsed,
        scene.sceneId,
        allowedSceneIds,
        nextScene?.sceneId || scene.sceneId,
        failScene?.sceneId || nextScene?.sceneId || scene.sceneId,
        optionCounts.totalOptions,
        'ai_generated'
      );

      if (avenues.length === optionCounts.totalOptions) {
        return {
          success: true,
          avenues,
          debug: createDebugEntry({
            phase: 'option_generation',
            attempt,
            ok: true,
            summary: `Generated ${avenues.length} options (${optionCounts.validOptions} valid, ${optionCounts.failOptions} fail)`,
            model,
            sceneId: scene.sceneId
          })
        };
      }
    } catch (error) {
      logger.error('[OPTION_GEN] error', {
        sceneId: scene.sceneId,
        attempt,
        summary: error.message
      });
      if (attempt === MAX_ATTEMPTS) {
        return {
          success: false,
          avenues: [],
          debug: createDebugEntry({
            phase: 'option_generation',
            attempt,
            ok: false,
            summary: error.message || 'Option generation failed',
            model,
            sceneId: scene.sceneId
          })
        };
      }
    }
  }

  return {
    success: false,
    avenues: [],
    debug: createDebugEntry({
      phase: 'option_generation',
      attempt: MAX_ATTEMPTS,
      ok: false,
      summary: 'Option generation exhausted retries',
      model,
      sceneId: scene.sceneId
    })
  };
}

export async function generateGameOptions(inputGame, requestedSceneIds = []) {
  const client = createLmStudioClient();
  const model = getLmStudioModel();
  let game = normalizeGameTemplate(inputGame);
  const existingPending = new Set(
    (game.generationState?.pendingSceneIds || []).length > 0
      ? game.generationState.pendingSceneIds
      : game.scenes.filter((scene) => scene.kind !== 'ending' && (scene.avenues || []).length === 0).map((scene) => scene.sceneId)
  );
  const targets = requestedSceneIds.length > 0
    ? new Set(requestedSceneIds)
    : new Set(game.scenes.filter((scene) => scene.kind !== 'ending').map((scene) => scene.sceneId));
  const debug = [...(game.generationState?.debug || [])];

  logger.info('[OPTION_GEN] start', {
    title: game.title,
    targetCount: targets.size,
    difficulty: game.storyConfig?.difficulty
  });

  game = updateGenerationState(game, [...new Set([...existingPending, ...targets])], debug, 'generating_options');

  for (const scene of game.scenes) {
    if (scene.kind === 'ending' || !targets.has(scene.sceneId)) continue;

    const result = await generateOptionsForScene({ client, model, game, scene });
    debug.push(result.debug);

    if (result.success) {
      game = applySceneOptions(game, scene.sceneId, result.avenues);
      targets.delete(scene.sceneId);
      existingPending.delete(scene.sceneId);
    } else {
      existingPending.add(scene.sceneId);
      game.authoringWarnings = [
        ...(game.authoringWarnings || []),
        `Option generation failed for ${scene.sceneId}. Manual authoring required.`
      ];
    }
  }

  const validation = validateGameTemplate(game, { mode: 'draft' });
  const autoPending = game.scenes
    .filter((scene) => scene.kind !== 'ending' && (scene.avenues || []).length === 0)
    .map((scene) => scene.sceneId);
  const pendingSceneIds = [...new Set([...existingPending, ...targets, ...autoPending])];
  const status = pendingSceneIds.length === 0 && validation.ok ? 'options_ready' : 'manual_required';
  game = updateGenerationState(
    game,
    pendingSceneIds,
    debug,
    status,
    pendingSceneIds.length === 0 ? '' : 'One or more scenes require manual option authoring'
  );

  logger.info('[OPTION_GEN] finish', {
    title: game.title,
    status,
    pendingSceneIds: game.generationState.pendingSceneIds
  });

  return {
    success: targets.size === 0,
    game
  };
}
