import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  recordFallback,
  recordComputeApprox,
  recordLlmUsage,
  recordMockResponse,
  recordProviderError,
  recordRouteType
} from './resolverMetricsService.js';
import { withLlmTimeout } from './lmStudioService.js';

function getProviderConfig() {
  console.log('[LLM_RESOLVER] 🔧 Getting provider config...');
  if (env.llmProvider === 'lmstudio') {
    console.log(`[LLM_RESOLVER] ✅ Using LMStudio: ${env.lmStudioBaseUrl} | Model: ${env.lmStudioModel}`);
    return {
      provider: 'lmstudio',
      apiKey: env.lmStudioApiKey || 'lm-studio',
      baseURL: env.lmStudioBaseUrl,
      model: env.lmStudioModel,
      hasApiKey: true,
      headers: {}
    };
  }

  console.log(`[LLM_RESOLVER] ✅ Using OpenRouter | Model: ${env.openRouterModel}`);
  return {
    provider: 'openrouter',
    apiKey: env.openRouterApiKey || 'missing-key',
    baseURL: 'https://openrouter.ai/api/v1',
    model: env.openRouterModel,
    hasApiKey: Boolean(env.openRouterApiKey),
    headers: {
      'HTTP-Referer': env.openRouterSiteUrl,
      'X-Title': env.openRouterSiteName
    }
  };
}

function createClient() {
  const provider = getProviderConfig();
  return {
    provider,
    client: new OpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      defaultHeaders: provider.headers
    })
  };
}

function mockResponse(payload) {
  const { provider } = createClient();
  return {
    id: `resp_mock_${Date.now()}`,
    object: 'response',
    status: 'completed',
    model: provider.model,
    output: [
      {
        id: `msg_mock_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify(payload)
          }
        ]
      }
    ]
  };
}

function parseOutput(response, fallback = {}) {
  const outputText =
    response.output_text ||
    response.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text ||
    '{}';

  try {
    // Strip markdown code blocks (```json and ```)
    let cleanedText = outputText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    logger.warn('Failed to parse LLM JSON output; using fallback', {
      message: error.message,
      rawText: outputText.substring(0, 200)
    });
    return fallback;
  }
}

function parseUsage(response) {
  const usage = response?.usage || {};
  const inputTokens = Number(
    usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokenCount ?? usage.promptTokenCount ?? 0
  );
  const outputTokens = Number(
    usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokenCount ?? usage.candidatesTokenCount ?? 0
  );
  const totalTokens = Number(usage.total_tokens ?? usage.totalTokenCount ?? inputTokens + outputTokens);
  return { inputTokens, outputTokens, totalTokens };
}

function sanitizeForPrompt(input) {
  return String(input || '')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function captureComputeStart() {
  return {
    hr: process.hrtime.bigint(),
    cpu: process.cpuUsage()
  };
}

function captureComputeEnd(provider, start) {
  const elapsedNs = process.hrtime.bigint() - start.hr;
  const cpuDiff = process.cpuUsage(start.cpu);
  const mem = process.memoryUsage();
  const sample = {
    provider,
    latencyMs: Number(elapsedNs) / 1e6,
    cpuUserMs: cpuDiff.user / 1000,
    cpuSystemMs: cpuDiff.system / 1000,
    rssMb: mem.rss / (1024 * 1024),
    heapUsedMb: mem.heapUsed / (1024 * 1024)
  };
  recordComputeApprox(sample);
  return sample;
}

function heuristicClassify({ input, avenues, mode = 'legacy' }) {
  const normalized = input.toLowerCase();
  const matched = avenues.find((avenue) => {
    const labelHit = normalized.includes(avenue.label.toLowerCase());
    const keywordHit = (avenue.keywords || []).some((keyword) => normalized.includes(keyword.toLowerCase()));
    return labelHit || keywordHit;
  });

  if (matched) {
    return {
      routeType: 'avenue',
      avenueId: matched.avenueId,
      confidence: 0.82,
      explanation: 'Heuristic keyword match selected this authored avenue.'
    };
  }

  if (normalized.length < 6) {
    return {
      routeType: mode === 'authored-only' ? 'no_match' : 'clarification',
      avenueId: null,
      confidence: 0.3,
      explanation: mode === 'authored-only'
        ? 'Input does not clearly match any authored route.'
        : 'Input is too short to resolve confidently.'
    };
  }

  if (mode === 'authored-only') {
    return {
      routeType: 'no_match',
      avenueId: null,
      confidence: 0.18,
      explanation: 'No authored route matched this input.'
    };
  }

  return {
    routeType: 'wildcard',
    avenueId: null,
    confidence: 0.56,
    explanation: 'No strong authored avenue match; wildcard candidate.',
    wildcard: { mode: 'low-reward' }
  };
}

/**
 * Classify player input into an authored avenue, bounded wildcard, no_match, or clarification.
 */
export async function classifyRoute({ gameTitle, sceneNarrative, input, avenues, history, wildcardEnabled, mode = 'legacy' }) {
  console.log('[LLM_CLASSIFY] 🎯 Starting classification...');
  console.log(`[LLM_CLASSIFY] 📖 Input: "${input}"`);
  console.log(`[LLM_CLASSIFY] 📍 Available avenues: ${avenues.map(a => a.label).join(', ')}`);

  const { provider, client } = createClient();
  const fallbackAvenue = avenues[0]?.avenueId || null;
  const heuristic = heuristicClassify({ input, avenues, mode });

  if (mode === 'authored-only' && provider.provider !== 'lmstudio') {
    console.log('[LLM_CLASSIFY] ⛔ Refusing non-LMStudio provider for authored-only mode');
    recordProviderError();
    recordRouteType('no_match');
    return {
      ...heuristic,
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ ...heuristic, reason: 'lmstudio_required' })
    };
  }

  if (!provider.hasApiKey) {
    console.log('[LLM_CLASSIFY] ⚠️ No API key - using heuristic fallback');
    recordMockResponse();
    recordRouteType(heuristic.routeType);
    recordLlmUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    return {
      ...heuristic,
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ ...heuristic, reason: 'mock_no_api_key' })
    };
  }

  console.log('[LLM_CLASSIFY] 🔄 Calling LLM provider...');
  const prompt = [
    `Game: ${gameTitle}`,
    `Scene: ${sceneNarrative}`,
    `Player input: ${sanitizeForPrompt(input)}`,
    `Recent turns: ${JSON.stringify(
      history.slice(-3).map((item) => ({
        turn: item.turn,
        userQuery: sanitizeForPrompt(item.userQuery),
        resolvedAvenueId: item.resolvedAvenueId
      }))
    )}`,
    `Avenues: ${JSON.stringify(avenues.map((a) => ({ avenueId: a.avenueId, label: a.label, keywords: a.keywords })))}`,
    `Wildcard enabled: ${wildcardEnabled}`,
    `Mode: ${mode}`,
    '',
    'CONFIDENCE CALIBRATION GUIDELINES (use these as your reference):',
    '• 0.9-1.0: ONLY for exact keyword/phrase matches (user says exact avenue label or keyword)',
    '• 0.7-0.9: Strong semantic match (user clearly expresses intent matching an avenue)',
    '• 0.5-0.7: Moderate confidence (user intent aligns but is vague or ambiguous)',
    '• 0.3-0.5: Low confidence (input is unclear, needs clarification)',
    '• 0.0-0.3: Very low confidence (completely unclear or contradictory)',
    '',
    'Be conservative with your confidence scores. When in doubt, choose a lower value.',
    '',
    'Return strict JSON only with this shape:',
    '{"routeType":"avenue|wildcard|clarification|no_match","avenueId":"<id>|null","confidence":0-1,"explanation":"short","wildcard":{"mode":"high-reward|low-reward","destinationSceneId":"optional"}}',
    'Never invent avenue IDs.'
  ].join('\n');

  try {
    const computeStart = captureComputeStart();
    const response = await withLlmTimeout(
      client.responses.create({
        model: provider.model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: 'Classify player input into avenue, wildcard, or clarification for a deterministic story graph.'
              }
            ]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }]
          }
        ]
      }),
      15000,
      'classify_route'
    );

    console.log('[LLM_CLASSIFY] ✅ Got LLM response, parsing...');
    const parsed = parseOutput(response, heuristic);
    const usage = parseUsage(response);
    const computeApprox = captureComputeEnd(provider.provider, computeStart);
    recordLlmUsage(usage);

    // DEBUG: Log what we actually got from the LLM
    console.log('[LLM_CLASSIFY] 🔍 Raw parsed result:', JSON.stringify(parsed, null, 2));
    console.log('[LLM_CLASSIFY] 🔍 Heuristic fallback would be:', JSON.stringify(heuristic, null, 2));

    const routeType = ['avenue', 'wildcard', 'clarification', 'no_match'].includes(parsed.routeType)
      ? parsed.routeType
      : heuristic.routeType;
    const validAvenue = avenues.some((a) => a.avenueId === parsed.avenueId);
    const avenueId = validAvenue ? parsed.avenueId : routeType === 'avenue' ? fallbackAvenue : null;

    console.log(`[LLM_CLASSIFY] 📊 Result: routeType=${routeType}, avenueId=${avenueId}, confidence=${parsed.confidence || heuristic.confidence || 0.5}`);
    console.log(`[LLM_CLASSIFY] ⏱️  Latency: ${computeApprox.latencyMs.toFixed(1)}ms | Tokens: ${usage.totalTokens}`);

    if (!validAvenue && routeType === 'avenue') {
      console.log('[LLM_CLASSIFY] ⚠️ Invalid avenue ID, using fallback');
      recordFallback();
    }
    recordRouteType(routeType);
    return {
      routeType,
      avenueId,
      confidence: Number(parsed.confidence || heuristic.confidence || 0.5),
      explanation: parsed.explanation || 'Mapped by classifier.',
      wildcard: parsed.wildcard || null,
      provider: provider.provider,
      usage,
      computeApprox,
      providerResponse: response
    };
  } catch (error) {
    console.log(`[LLM_CLASSIFY] ❌ Provider call failed: ${error.message}`);
    logger.error('Classifier provider call failed', { message: error.message });
    recordProviderError();
    recordMockResponse();
    recordRouteType(heuristic.routeType);
    recordLlmUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    return {
      ...heuristic,
      avenueId: heuristic.routeType === 'avenue' ? (heuristic.avenueId || fallbackAvenue) : null,
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ ...heuristic, reason: 'mock_provider_error' })
    };
  }
}

/**
 * Generate wizard dialogue for game ending based on player performance.
 */
export async function generateWizardDialogue({ gameTitle, grade, points, targetPoints, turnsUsed, maxTurns, status, choices }) {
  console.log('[LLM_WIZARD] 🧙 Generating ending dialogue...');
  console.log(`[LLM_WIZARD] 📊 Grade: ${grade} | Points: ${points}/${targetPoints} | Status: ${status}`);

  const { provider, client } = createClient();

  // Sharper personality-based fallback dialogues
  const getFallbackDialogue = () => {
    if (status === 'won') {
      if (grade === 'S') return 'LEGENDARY! The stars themselves bow to your brilliance! You are truly chosen!';
      if (grade === 'A') return 'Outstanding! Your potential is limitless. I sense great destinies ahead for you!';
      if (grade === 'B') return 'You won. Competently. I suppose that counts for something these days.';
    }
    if (grade === 'C') return 'You survived. I\'ve seen slimes with better survival instincts, but... congrats?';
    return 'Pathetic. My cauldron has more talent than you. Perhaps try a game with... less thinking?';
  };

  if (!provider.hasApiKey) {
    console.log('[LLM_WIZARD] ⚠️ No API key - using fallback');
    recordMockResponse();
    recordLlmUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    return {
      dialogue: getFallbackDialogue(),
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ dialogue: getFallbackDialogue(), reason: 'mock_no_api_key' })
    };
  }

  // Format choices for the prompt
  const choicesSummary = choices.map((c, i) => `${i + 1}. "${c.userQuery}" → ${c.resolvedAvenueId || 'wildcard'} (${c.pointsDelta >= 0 ? '+' : ''}${c.pointsDelta} pts)`).join('\n');

  // Define wizard personalities based on grade and outcome
  const getWizardPersonality = () => {
    if (status === 'won') {
      if (grade === 'S' || grade === 'A') {
        return {
          persona: 'HOPEFUL WIZARD',
          tone: 'ecstatic, reverent, almost weeping with joy',
          traits: 'believes the player is the chosen one, sees limitless potential, dramatic and flowery language',
          examples: 'speak like a mystic who has witnessed a prophecy fulfilled, use exclamation marks, reference stars/destiny'
        };
      }
      if (grade === 'B') {
        return {
          persona: 'CYNIC WIZARD',
          tone: 'dry, unimpressed, mildly disappointed',
          traits: 'seen thousands of heroes, player is merely adequate, backhanded compliments',
          examples: 'speak like someone who expects better, use phrases like "I suppose" and "adequate", subtle sarcasm'
        };
      }
    }
    if (grade === 'C') {
      return {
        persona: 'CYNIC WIZARD',
        tone: 'disappointed, mocking, unimpressed',
        traits: 'surprised the player survived at all, condescending',
        examples: 'compare player unfavorably to slimes or goblins, express surprise at basic competence'
      };
    }
    return {
      persona: 'HARSH MASTER',
      tone: 'insulting, dismissive, cruel',
      traits: 'openly mocks player\'s intelligence, suggests they should quit adventuring',
      examples: 'suggest farming or alchemy as better career paths, question their life choices, biting sarcasm'
    };
  };

  const personality = getWizardPersonality();

  const prompt = [
    `You are an 8-bit wizard NPC with a DISTINCT PERSONALITY giving ending dialogue to a player.`,
    '',
    `WIZARD PERSONALITY: ${personality.persona}`,
    `Tone: ${personality.tone}`,
    `Traits: ${personality.traits}`,
    `Style Examples: ${personality.examples}`,
    '',
    `Game: ${gameTitle}`,
    `Player Performance:`,
    `- Grade: ${grade}`,
    `- Points: ${points} / Target: ${targetPoints}`,
    `- Turns: ${turnsUsed} / Max: ${maxTurns}`,
    `- Result: ${status === 'won' ? 'VICTORY' : 'DEFEAT'}`,
    '',
    `Player Choices:\n${choicesSummary || 'No choices recorded'}`,
    '',
    `Generate a SHORT, SHARP response (max 25 words) that:`,
    `- EMBODIES your specific personality type (${personality.persona})`,
    `- Is MEMORABLE and leaves a strong impression`,
    `- References their grade (${grade}) and result (${status})`,
    `- Uses dramatic language appropriate to your personality`,
    '',
    `Return strict JSON only: {"dialogue":"short response"}`
  ].join('\n');

  try {
    console.log('[LLM_WIZARD] 🔄 Calling LLM provider...');
    const computeStart = captureComputeStart();
    const response = await withLlmTimeout(
      client.responses.create({
        model: provider.model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: `You are an 8-bit wizard NPC with one of three personalities: HOPEFUL (for excellent grades), CYNIC (for mediocre grades), or HARSH MASTER (for failures). Stay strictly in character.` }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }]
          }
        ]
      }),
      15000,
      'wizard_dialogue'
    );

    console.log('[LLM_WIZARD] ✅ Got LLM response, parsing...');
    const parsed = parseOutput(response, { dialogue: getFallbackDialogue() });
    const usage = parseUsage(response);
    const computeApprox = captureComputeEnd(provider.provider, computeStart);
    recordLlmUsage(usage);

    console.log(`[LLM_WIZARD] 📖 Dialogue: "${parsed.dialogue?.substring(0, 50)}..."`);
    console.log(`[LLM_WIZARD] ⏱️  Latency: ${computeApprox.latencyMs.toFixed(1)}ms | Tokens: ${usage.totalTokens}`);

    return {
      dialogue: parsed.dialogue || getFallbackDialogue(),
      provider: provider.provider,
      usage,
      computeApprox,
      providerResponse: response
    };
  } catch (error) {
    console.log(`[LLM_WIZARD] ❌ Provider call failed: ${error.message}`);
    logger.error('Wizard dialogue provider call failed', { message: error.message });
    recordProviderError();
    recordMockResponse();
    recordLlmUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    const fallback = getFallbackDialogue();
    return {
      dialogue: fallback,
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ dialogue: fallback, reason: 'mock_provider_error' })
    };
  }
}

/**
 * Generate concise narration text for an already-approved resolution outcome.
 */
export async function generateNarration({
  gameTitle,
  sceneNarrative,
  playerInput,
  resolutionType,
  routeLabel,
  tone = 'cinematic'
}) {
  console.log('[LLM_NARRATE] ✍️  Generating narration...');
  console.log(`[LLM_NARRATE] 📝 Resolution: ${resolutionType} | Route: ${routeLabel || 'n/a'} | Tone: ${tone}`);

  const { provider, client } = createClient();
  const fallbackText = `Action resolved as ${resolutionType}${routeLabel ? ` (${routeLabel})` : ''}.`;

  if (!provider.hasApiKey) {
    console.log('[LLM_NARRATE] ⚠️ No API key - using fallback');
    recordMockResponse();
    recordLlmUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    return {
      text: `${fallbackText} ${sceneNarrative}`,
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ narration: fallbackText, reason: 'mock_no_api_key' })
    };
  }

  const prompt = [
    `Game: ${gameTitle}`,
    `Current scene: ${sceneNarrative}`,
    `Player input: ${sanitizeForPrompt(playerInput)}`,
    `Resolution type: ${resolutionType}`,
    `Resolved route label: ${routeLabel || 'n/a'}`,
    `Tone: ${tone}`,
    'Return strict JSON only: {"text":"max 120 words"}'
  ].join('\n');

  try {
    console.log('[LLM_NARRATE] 🔄 Calling LLM provider...');
    const computeStart = captureComputeStart();
    const response = await withLlmTimeout(
      client.responses.create({
        model: provider.model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: 'Narrate approved game outcomes. Keep concise and vivid.' }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }]
          }
        ]
      }),
      15000,
      'generate_narration'
    );

    console.log('[LLM_NARRATE] ✅ Got LLM response, parsing...');
    const parsed = parseOutput(response, { text: fallbackText });
    const usage = parseUsage(response);
    const computeApprox = captureComputeEnd(provider.provider, computeStart);
    recordLlmUsage(usage);

    console.log(`[LLM_NARRATE] 📖 Narration: "${parsed.text?.substring(0, 80)}..."`);
    console.log(`[LLM_NARRATE] ⏱️  Latency: ${computeApprox.latencyMs.toFixed(1)}ms | Tokens: ${usage.totalTokens}`);

    return {
      text: parsed.text || fallbackText,
      provider: provider.provider,
      usage,
      computeApprox,
      providerResponse: response
    };
  } catch (error) {
    console.log(`[LLM_NARRATE] ❌ Provider call failed: ${error.message}`);
    logger.error('Narration provider call failed', { message: error.message });
    recordProviderError();
    recordMockResponse();
    recordLlmUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    return {
      text: `${fallbackText} ${sceneNarrative}`,
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ narration: fallbackText, reason: 'mock_provider_error' })
    };
  }
}
