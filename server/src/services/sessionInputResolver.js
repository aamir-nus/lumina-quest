import { classifyRoute } from './llmResolver.js';
import { logger } from '../utils/logger.js';

export function stripInputText(value) {
  return String(value || '').trim();
}

export function normalizeInputText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fast direct string match after stripping whitespace
 * This is the first optimization - simple exact match
 */
export function findDirectAvenueMatch(input, avenues = []) {
  const strippedInput = stripInputText(input);
  if (!strippedInput) return null;
  return avenues.find((avenue) => stripInputText(avenue.label) === strippedInput) || null;
}

/**
 * Normalized match for case-insensitive comparison
 * This is the second optimization - normalized exact match
 */
export function findExactAvenueMatch(input, avenues = []) {
  const normalizedInput = normalizeInputText(input);
  if (!normalizedInput) return null;
  return avenues.find((avenue) => normalizeInputText(avenue.label) === normalizedInput) || null;
}

export async function resolveSceneInput({
  game,
  currentScene,
  sessionHistory,
  userInput
}) {
  const avenues = currentScene.avenues || [];

  // Direct selection via frontend button click (bypasses all matching/LLM)
  const directSelectionMatch = userInput.match(/^\[SELECT:([^\]]+)\]\s*/);
  if (directSelectionMatch) {
    const avenueId = directSelectionMatch[1];
    const avenue = avenues.find((a) => a.avenueId === avenueId);
    if (avenue) {
      logger.info('[INPUT_MATCH] direct_selection', {
        sceneId: currentScene.sceneId,
        avenueId
      });
      return {
        routeType: 'avenue',
        matchedBy: 'direct_selection',
        avenueId: avenue.avenueId,
        confidence: 1,
        explanation: 'Direct button selection.',
        provider: 'deterministic',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        computeApprox: null,
        providerResponse: null
      };
    }
  }

  // First optimization: direct stripped match (fastest)
  const directMatch = findDirectAvenueMatch(userInput, avenues);
  if (directMatch) {
    logger.info('[INPUT_MATCH] direct', {
      sceneId: currentScene.sceneId,
      avenueId: directMatch.avenueId
    });
    return {
      routeType: 'avenue',
      matchedBy: 'direct',
      avenueId: directMatch.avenueId,
      confidence: 1,
      explanation: 'Direct stripped text matched an authored route.',
      provider: 'deterministic',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: null
    };
  }

  // Second optimization: normalized match (case-insensitive)
  const exactMatch = findExactAvenueMatch(userInput, avenues);
  if (exactMatch) {
    logger.info('[INPUT_MATCH] normalized', {
      sceneId: currentScene.sceneId,
      avenueId: exactMatch.avenueId
    });
    return {
      routeType: 'avenue',
      matchedBy: 'normalized',
      avenueId: exactMatch.avenueId,
      confidence: 1,
      explanation: 'Normalized option text matched an authored route.',
      provider: 'deterministic',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: null
    };
  }

  // No match found - call LLM classifier
  const isV2 = Number(game.schemaVersion || 1) >= 2;
  const classified = await classifyRoute({
    gameTitle: game.title,
    sceneNarrative: currentScene.narrative,
    input: userInput,
    avenues: currentScene.avenues,
    history: sessionHistory,
    wildcardEnabled: !isV2 && Boolean(game.wildcardConfig?.enabled),
    mode: isV2 ? 'authored-only' : 'legacy'
  });

  return {
    ...classified,
    matchedBy: classified.routeType === 'avenue' ? 'llm' : 'none'
  };
}
