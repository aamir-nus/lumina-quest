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
  if (env.llmProvider === 'lmstudio') {
    return {
      provider: 'lmstudio',
      apiKey: env.lmStudioApiKey || 'lm-studio',
      baseURL: env.lmStudioBaseUrl,
      model: env.lmStudioModel,
      hasApiKey: true,
      headers: {}
    };
  }

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

export async function classifyRoute({ gameTitle, sceneNarrative, input, avenues, history, wildcardEnabled }) {
  const { provider, client } = createClient();
  const fallbackAvenue = avenues[0]?.avenueId || null;
  const heuristic = heuristicClassify({ input, avenues });

  if (!provider.hasApiKey) {
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

  const prompt = [
    `Game: ${gameTitle}`,
    `Scene: ${sceneNarrative}`,
    `Player input: ${input}`,
    `Recent turns: ${JSON.stringify(history.slice(-3))}`,
    `Avenues: ${JSON.stringify(avenues.map((a) => ({ avenueId: a.avenueId, label: a.label, keywords: a.keywords })))}`,
    `Wildcard enabled: ${wildcardEnabled}`,
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

    const parsed = parseOutput(response, heuristic);
    const usage = parseUsage(response);
    const computeApprox = captureComputeEnd(provider.provider, computeStart);
    recordLlmUsage(usage);
    const routeType = ['avenue', 'wildcard', 'clarification'].includes(parsed.routeType)
      ? parsed.routeType
      : heuristic.routeType;
    const validAvenue = avenues.some((a) => a.avenueId === parsed.avenueId);
    const avenueId = validAvenue ? parsed.avenueId : fallbackAvenue;

    if (!validAvenue && routeType === 'avenue') {
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

export async function generateNarration({
  gameTitle,
  sceneNarrative,
  playerInput,
  resolutionType,
  routeLabel,
  tone = 'cinematic'
}) {
  const { provider, client } = createClient();
  const fallbackText = `Action resolved as ${resolutionType}${routeLabel ? ` (${routeLabel})` : ''}.`;

  if (!provider.hasApiKey) {
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
    `Player input: ${playerInput}`,
    `Resolution type: ${resolutionType}`,
    `Resolved route label: ${routeLabel || 'n/a'}`,
    `Tone: ${tone}`,
    'Return strict JSON only: {"text":"max 120 words"}'
  ].join('\n');

  try {
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

    const parsed = parseOutput(response, { text: fallbackText });
    const usage = parseUsage(response);
    const computeApprox = captureComputeEnd(provider.provider, computeStart);
    recordLlmUsage(usage);
    return {
      text: parsed.text || fallbackText,
      provider: provider.provider,
      usage,
      computeApprox,
      providerResponse: response
    };
  } catch (error) {
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
