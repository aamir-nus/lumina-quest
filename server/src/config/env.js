import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/luminaquest',
  mongoConnectRetries: Number(process.env.MONGO_CONNECT_RETRIES || 5),
  mongoConnectRetryDelayMs: Number(process.env.MONGO_CONNECT_RETRY_DELAY_MS || 2000),
  jwtSecret: process.env.JWT_SECRET || '',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  requestJsonLimit: process.env.REQUEST_JSON_LIMIT || '256kb',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
  openRouterSiteName: process.env.OPENROUTER_SITE_NAME || 'LuminaQuest',
  langfuseHost: process.env.LANGFUSE_HOST || '',
  langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY || ''
};

export function validateEnv() {
  if (!env.jwtSecret || env.jwtSecret.length < 24) {
    throw new Error('JWT_SECRET must be set and at least 24 characters.');
  }
}
