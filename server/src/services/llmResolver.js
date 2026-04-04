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
    return JSON.parse(outputText);
  } catch (error) {
    logger.warn('Failed to parse LLM JSON output; using fallback', {
      message: error.message
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

function heuristicClassify({ input, avenues }) {
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
      routeType: 'clarification',
      avenueId: null,
      confidence: 0.3,
      explanation: 'Input is too short to resolve confidently.'
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
 * Classify player input into an authored avenue, bounded wildcard, or clarification.
 */
export async function classifyRoute({ gameTitle, sceneNarrative, input, avenues, history, wildcardEnabled }) {
  console.log('[LLM_CLASSIFY] 🎯 Starting classification...');
  console.log(`[LLM_CLASSIFY] 📖 Input: "${input}"`);
  console.log(`[LLM_CLASSIFY] 📍 Available avenues: ${avenues.map(a => a.label).join(', ')}`);

  const { provider, client } = createClient();
  const fallbackAvenue = avenues[0]?.avenueId || null;
  const heuristic = heuristicClassify({ input, avenues });

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
    '{"routeType":"avenue|wildcard|clarification","avenueId":"<id>|null","confidence":0-1,"explanation":"short","wildcard":{"mode":"high-reward|low-reward","destinationSceneId":"optional"}}',
    'Never invent avenue IDs.'
  ].join('\n');

  try {
    const computeStart = captureComputeStart();
    const response = await client.responses.create({
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
    });

    console.log('[LLM_CLASSIFY] ✅ Got LLM response, parsing...');
    const parsed = parseOutput(response, heuristic);
    const usage = parseUsage(response);
    const computeApprox = captureComputeEnd(provider.provider, computeStart);
    recordLlmUsage(usage);

    // DEBUG: Log what we actually got from the LLM
    console.log('[LLM_CLASSIFY] 🔍 Raw parsed result:', JSON.stringify(parsed, null, 2));
    console.log('[LLM_CLASSIFY] 🔍 Heuristic fallback would be:', JSON.stringify(heuristic, null, 2));

    const routeType = ['avenue', 'wildcard', 'clarification'].includes(parsed.routeType)
      ? parsed.routeType
      : heuristic.routeType;
    const validAvenue = avenues.some((a) => a.avenueId === parsed.avenueId);
    const avenueId = validAvenue ? parsed.avenueId : fallbackAvenue;

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
      avenueId: heuristic.avenueId || fallbackAvenue,
      provider: provider.provider,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      computeApprox: null,
      providerResponse: mockResponse({ ...heuristic, reason: 'mock_provider_error' })
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
    const response = await client.responses.create({
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
    });

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
