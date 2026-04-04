import OpenAI from 'openai';
import { env } from '../config/env.js';

export function assertLmStudioConfigured(context = 'lmstudio_request') {
  if (env.llmProvider !== 'lmstudio') {
    throw new Error(`${context} requires LLM_PROVIDER=lmstudio`);
  }
}

export function createLmStudioClient() {
  assertLmStudioConfigured('lmstudio_client');
  return new OpenAI({
    apiKey: env.lmStudioApiKey || 'lm-studio',
    baseURL: env.lmStudioBaseUrl
  });
}

export function getLmStudioModel() {
  assertLmStudioConfigured('lmstudio_model');
  return env.lmStudioModel;
}

export async function withLlmTimeout(promise, timeoutMs = 15000, label = 'lmstudio_request') {
  let timeoutId = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function parseJsonResponse(response, fallback = {}) {
  const outputText =
    response.output_text ||
    response.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text ||
    '{}';

  try {
    return JSON.parse(
      String(outputText)
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
    );
  } catch (error) {
    console.log('[LMSTUDIO] parse failure', {
      message: error.message,
      snippet: String(outputText).slice(0, 180)
    });
    return fallback;
  }
}
