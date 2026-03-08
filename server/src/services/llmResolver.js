import OpenAI from 'openai';
import { env } from '../config/env.js';

const client = new OpenAI({
  apiKey: env.openRouterApiKey || 'missing-key',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': env.openRouterSiteUrl,
    'X-Title': env.openRouterSiteName
  }
});

function mockResponse({ avenueId, reason }) {
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
            text: JSON.stringify({ avenueId, reason })
          }
        ]
      }
    ]
  };
}

function parseOutput(response) {
  const outputText =
    response.output_text ||
    response.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text ||
    '{}';

  try {
    return JSON.parse(outputText);
  } catch {
    return { avenueId: null, reason: 'non_json_response' };
  }
}

export async function resolveAvenue({ gameTitle, sceneNarrative, input, avenues, history }) {
  const fallbackAvenue = avenues[0]?.avenueId || null;

  if (!env.openRouterApiKey) {
    return {
      selectedAvenueId: fallbackAvenue,
      reason: 'mock_no_api_key',
      providerResponse: mockResponse({ avenueId: fallbackAvenue, reason: 'mock_no_api_key' })
    };
  }

  const prompt = [
    `Game: ${gameTitle}`,
    `Scene: ${sceneNarrative}`,
    `Player input: ${input}`,
    `Recent turns: ${JSON.stringify(history.slice(-3))}`,
    `Avenues: ${JSON.stringify(avenues.map((a) => ({ avenueId: a.avenueId, label: a.label, keywords: a.keywords })))}`,
    'Return strict JSON only: {"avenueId":"<id>|null","reason":"short"}. Use null if unclear.'
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
              text: 'You map player text to one of the available avenue IDs. Never invent IDs.'
            }
          ]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }]
        }
      ]
    });

    const parsed = parseOutput(response);
    const valid = avenues.some((a) => a.avenueId === parsed.avenueId);

    return {
      selectedAvenueId: valid ? parsed.avenueId : fallbackAvenue,
      reason: valid ? parsed.reason || 'mapped' : 'fallback_invalid_or_unclear',
      providerResponse: response
    };
  } catch {
    return {
      selectedAvenueId: fallbackAvenue,
      reason: 'mock_provider_error',
      providerResponse: mockResponse({ avenueId: fallbackAvenue, reason: 'mock_provider_error' })
    };
  }
}
