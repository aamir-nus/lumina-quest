import express from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const validationSchema = z.object({
  llmProvider: z.enum(['lmstudio', 'openrouter']),
  lmStudioBaseUrl: z.string().url().optional(),
  lmStudioModel: z.string().optional(),
  openRouterApiKey: z.string().optional(),
  openRouterModel: z.string().optional()
});

/**
 * POST /api/onboarding/validate-llm
 * Test LLM connection by making a lightweight API call
 */
router.post('/validate-llm', asyncHandler(async (req, res) => {
  const parsed = validationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'INVALID_INPUT', 'Invalid input', parsed.error.flatten());
  }

  const { llmProvider, lmStudioBaseUrl, lmStudioModel, openRouterApiKey, openRouterModel } = parsed.data;

  const startTime = Date.now();
  let client, testModel, providerName;

  try {
    if (llmProvider === 'lmstudio') {
      if (!lmStudioBaseUrl) {
        throw new ApiError(400, 'MISSING_URL', 'LM Studio Base URL is required');
      }
      providerName = 'LM Studio';
      client = new OpenAI({
        apiKey: 'lm-studio',
        baseURL: lmStudioBaseUrl
      });
      // Use provided model or fall back to environment variable
      testModel = lmStudioModel || env.lmStudioModel;
      if (!testModel) {
        throw new ApiError(400, 'MISSING_MODEL', 'Model name is required. Specify a model or use the one configured in .env');
      }
    } else {
      // openrouter
      if (!openRouterApiKey) {
        throw new ApiError(400, 'MISSING_API_KEY', 'OpenRouter API Key is required');
      }
      providerName = 'OpenRouter';
      client = new OpenAI({
        apiKey: openRouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1'
      });
      // Use provided model or fall back to environment variable
      testModel = openRouterModel || env.openRouterModel;
      if (!testModel) {
        throw new ApiError(400, 'MISSING_MODEL', 'Model name is required. Specify a model or use the one configured in .env');
      }
    }

    // Try to list models (lightweight test call)
    // Timeout after 10 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    const modelsPromise = client.models.list();
    const models = await Promise.race([modelsPromise, timeoutPromise]);

    const latency = Date.now() - startTime;

    // Check if the requested model exists in the list
    let modelFound = false;
    let availableModels = [];

    if (models && models.data) {
      availableModels = models.data.map((m) => m.id);
      modelFound = availableModels.includes(testModel) || availableModels.some((m) => m.includes(testModel));
    }

    // For LM Studio, if model list is empty but connection succeeded, we trust the user's model name
    // (LM Studio sometimes returns empty model list even when working)
    if (llmProvider === 'lmstudio' && availableModels.length === 0) {
      modelFound = true;
    }

    logger.info('[ONBOARDING] LLM validation successful', {
      provider: llmProvider,
      latency,
      modelFound,
      availableModelCount: availableModels.length
    });

    return res.json({
      ok: true,
      provider: llmProvider,
      providerName,
      latency,
      modelFound,
      testModel,
      availableModels: availableModels.slice(0, 10), // Return first 10 models
      warning: llmProvider === 'openrouter'
        ? 'OpenRouter is a paid fallback service. Quality and speed may vary compared to local LLM.'
        : undefined
    });
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.warn('[ONBOARDING] LLM validation failed', {
      provider: llmProvider,
      error: error.message,
      latency
    });

    // Determine error type for better UX
    let errorType = 'CONNECTION_ERROR';
    let errorMessage = 'Could not connect to LLM service.';

    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      errorType = 'TIMEOUT';
      errorMessage = `Connection to ${providerName} timed out. Check that the service is running.`;
    } else if (error.message.includes('ECONNREFUSED')) {
      errorType = 'CONNECTION_REFUSED';
      errorMessage = `Could not reach ${providerName} at the specified URL. Verify the URL and that the service is running.`;
    } else if (error.response?.status === 401) {
      errorType = 'AUTH_ERROR';
      errorMessage = 'Invalid API key or authentication failed.';
    }

    return res.status(400).json({
      ok: false,
      provider: llmProvider,
      providerName,
      error: errorType,
      message: errorMessage,
      latency
    });
  }
}));

/**
 * GET /api/onboarding/default-config
 * Return current/default LLM configuration for client reference
 */
router.get('/default-config', (_req, res) => {
  res.json({
    defaultLlmProvider: env.llmProvider || 'openrouter',
    defaultLmStudioBaseUrl: env.lmStudioBaseUrl,
    defaultLmStudioModel: env.lmStudioModel,
    defaultOpenRouterModel: env.openRouterModel
  });
});

export default router;
