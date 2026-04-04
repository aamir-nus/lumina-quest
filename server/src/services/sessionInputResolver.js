import { classifyRoute } from './llmResolver.js';

export function normalizeInputText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  const exactMatch = findExactAvenueMatch(userInput, currentScene.avenues || []);
  if (exactMatch) {
    console.log('[INPUT_MATCH] exact', {
      sceneId: currentScene.sceneId,
      avenueId: exactMatch.avenueId
    });
    return {
      routeType: 'avenue',
      matchedBy: 'exact',
      avenueId: exactMatch.avenueId,
      confidence: 1,
      explanation: 'Exact option text matched an authored route.',
      provider: 'deterministic',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: null
    };
  }

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
