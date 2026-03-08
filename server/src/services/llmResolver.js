import OpenAI from 'openai';
import { env } from '../config/env.js';
import {
  recordFallback,
  recordMockResponse,
  recordProviderError,
  recordRouteType
} from './resolverMetricsService.js';

const client = new OpenAI({
  apiKey: env.openRouterApiKey || 'missing-key',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': env.openRouterSiteUrl,
    'X-Title': env.openRouterSiteName
  }
});

function mockResponse(payload) {
  return {
    id: `resp_mock_${Date.now()}`,
    object: 'response',
    status: 'completed',
    model: env.openRouterModel,
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
  } catch {
    return fallback;
  }
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
  const fallbackAvenue = avenues[0]?.avenueId || null;
  const heuristic = heuristicClassify({ input, avenues });

  if (!env.openRouterApiKey) {
    recordMockResponse();
    recordRouteType(heuristic.routeType);
    return {
      ...heuristic,
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
    const response = await client.responses.create({
      model: env.openRouterModel,
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
      providerResponse: response
    };
  } catch {
    recordProviderError();
    recordMockResponse();
    recordRouteType(heuristic.routeType);
    return {
      ...heuristic,
      avenueId: heuristic.avenueId || fallbackAvenue,
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
  const fallbackText = `Action resolved as ${resolutionType}${routeLabel ? ` (${routeLabel})` : ''}.`;

  if (!env.openRouterApiKey) {
    recordMockResponse();
    return {
      text: `${fallbackText} ${sceneNarrative}`,
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
    const response = await client.responses.create({
      model: env.openRouterModel,
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
    return { text: parsed.text || fallbackText, providerResponse: response };
  } catch {
    recordProviderError();
    recordMockResponse();
    return {
      text: `${fallbackText} ${sceneNarrative}`,
      providerResponse: mockResponse({ narration: fallbackText, reason: 'mock_provider_error' })
    };
  }
}
