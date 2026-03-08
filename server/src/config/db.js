import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATE = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getDbStatus() {
  return {
    state: READY_STATE[mongoose.connection.readyState] || 'unknown',
    readyState: mongoose.connection.readyState
  };
}

export async function connectMongoWithRetry() {
  let attempt = 0;
  let lastError = null;

  while (attempt < env.mongoConnectRetries) {
    attempt += 1;
    try {
      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 5000
      });
      return;
    } catch (error) {
      lastError = error;
      logger.warn('Mongo connect failed', {
        attempt,
        retries: env.mongoConnectRetries,
        message: error.message
      });
      if (attempt < env.mongoConnectRetries) {
        await sleep(env.mongoConnectRetryDelayMs);
      }
    }
  }

  const nextStep = [
    'Unable to connect to MongoDB after retries.',
    `Expected URI: ${env.mongoUri}`,
    'If running locally, start Mongo first (e.g., `docker compose up -d mongo`).'
  ].join(' ');

  throw new Error(`${nextStep} Last error: ${lastError?.message || 'unknown'}`);
}
