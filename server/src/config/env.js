import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/luminaquest',
  mongoConnectRetries: Number(process.env.MONGO_CONNECT_RETRIES || 5),
  mongoConnectRetryDelayMs: Number(process.env.MONGO_CONNECT_RETRY_DELAY_MS || 2000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
  openRouterSiteName: process.env.OPENROUTER_SITE_NAME || 'LuminaQuest'
};
