import { classifyRoute } from './llmResolver.js';

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

  // First optimization: direct stripped match (fastest)
  const directMatch = findDirectAvenueMatch(userInput, avenues);
  if (directMatch) {
    console.log('[INPUT_MATCH] direct', {
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
    console.log('[INPUT_MATCH] normalized', {
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
      usage: { inputTokens: 0, outputTokens: 0, outputTokens: 0, totalTokens: 0 },
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
