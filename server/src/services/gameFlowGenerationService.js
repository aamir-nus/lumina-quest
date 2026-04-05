import { buildGameFlowPrompt } from './promptBuilders/gameFlowPromptBuilder.js';
import { buildFlowTemplate, createDebugEntry } from './gameGenerationSupport.js';
import { createLmStudioClient, getLmStudioModel, parseJsonResponse, withLlmTimeout } from './lmStudioService.js';
import { validateGameTemplate } from './gameTemplateValidator.js';
import { logger } from '../utils/logger.js';

const MAX_ATTEMPTS = 3;

function sanitizeSummary(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function coerceFlowPayload(payload) {
  const start = payload.start || {};
  const beats = Array.isArray(payload.beats) ? payload.beats : [];
  const endings = Array.isArray(payload.endings) ? payload.endings : [];

  return {
    start: {
      sceneId: start.sceneId || 'scene_start',
      narrative: sanitizeSummary(start.narrative, 'The journey begins.'),
      goalSummary: sanitizeSummary(start.goalSummary, 'Take the first meaningful step.')
    },
    beats: beats.map((beat, index) => ({
      sceneId: beat.sceneId || `scene_${index + 1}`,
      narrative: sanitizeSummary(beat.narrative, `Beat ${index + 1} unfolds.`),
      goalSummary: sanitizeSummary(beat.goalSummary, `Advance through beat ${index + 1}.`)
    })),
    endings: endings.map((ending, index) => ({
      sceneId: ending.sceneId || `scene_end_${index + 1}`,
      narrative: sanitizeSummary(ending.narrative, ending.endingType === 'fail' ? 'You fail.' : 'You prevail.'),
      goalSummary: sanitizeSummary(ending.goalSummary, ending.endingType === 'fail' ? 'The run ends badly.' : 'The run ends well.'),
      endingType: ending.endingType === 'fail' ? 'fail' : 'win'
    }))
  };
}

function buildManualFallback(input, debug, lastError) {
  const failEnding = {
    sceneId: 'scene_fail',
    narrative: 'Your plan unravels before it can succeed.',
    goalSummary: 'A rough ending waits here.',
    endingType: 'fail'
  };
  const winEnding = {
    sceneId: 'scene_win',
    narrative: input.endGoal,
    goalSummary: input.endGoal,
    endingType: 'win'
  };

  const beats = Array.from({ length: 3 }, (_, index) => ({
    sceneId: `scene_${index + 1}`,
    narrative: `Manual beat ${index + 1}: expand this story step.`,
    goalSummary: index === 2 ? input.endGoal : `Bridge ${input.startGoal} toward ${input.endGoal}`
  }));

  const template = buildFlowTemplate({
    title: input.title,
    description: input.description,
    storyConfig: {
      premise: input.premise,
      startGoal: input.startGoal,
      endGoal: input.endGoal,
      tone: input.tone,
      difficulty: input.difficulty
    },
    start: {
      sceneId: 'scene_start',
      narrative: input.startGoal,
      goalSummary: input.startGoal
    },
    beats,
    endings: [winEnding, failEnding]
  });

  template.generationState.status = 'manual_required';
  template.generationState.lastError = lastError;
  template.generationState.debug = debug;
  template.authoringWarnings = ['Flow generation failed after retries. Manual editing is required.'];
  return template;
}

export async function generateGameFlow(input) {
  const client = createLmStudioClient();
  const model = getLmStudioModel();
  const debug = [];

  logger.info('[FLOW_GEN] start', {
    title: input.title,
    difficulty: input.difficulty,
    tone: input.tone
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const prompt = buildGameFlowPrompt(input);
      logger.info('[FLOW_GEN] attempt', { attempt, model });

      const response = await withLlmTimeout(
        client.responses.create({
          model,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: 'Generate a bounded story flow for a deterministic authored graph.' }]
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }]
            }
          ]
        }),
        72000,
        'flow_generation'
      );

      const parsed = parseJsonResponse(response, {});
      const flow = coerceFlowPayload(parsed);
      const template = buildFlowTemplate({
        title: input.title,
        description: input.description,
        storyConfig: {
          premise: input.premise,
          startGoal: input.startGoal,
          endGoal: input.endGoal,
          tone: input.tone,
          difficulty: input.difficulty
        },
        ...flow
      });

      const validation = validateGameTemplate(template, { mode: 'draft' });
      const summary = validation.ok
        ? `Generated ${flow.beats.length} beats`
        : `Validation failed: ${validation.errors.join('; ')}`;
      debug.push(createDebugEntry({ phase: 'flow_generation', attempt, ok: validation.ok, summary, model }));

      logger.info('[FLOW_GEN] validation', {
        attempt,
        ok: validation.ok,
        errors: validation.errors,
        warnings: validation.warnings
      });

      if (validation.ok) {
        template.generationState.debug = debug;
        return { success: true, game: validation.normalized };
      }
    } catch (error) {
      const summary = `${error.message || 'Unknown flow generation error'}`;
      debug.push(createDebugEntry({ phase: 'flow_generation', attempt, ok: false, summary, model }));
      logger.error('[FLOW_GEN] error', { attempt, summary });
    }
  }

  const fallback = buildManualFallback(input, debug, 'Flow generation failed after 3 attempts');
  logger.info('[FLOW_GEN] fallback', {
    title: input.title,
    debugCount: debug.length
  });
  return { success: false, game: fallback, error: fallback.generationState.lastError };
}
