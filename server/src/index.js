import { app } from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectMongoWithRetry } from './config/db.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  validateEnv();
  await connectMongoWithRetry();
  app.listen(env.port, () => {
    logger.info('Server started', { url: `http://localhost:${env.port}` });
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap server', { message: error.message, stack: error.stack });
  process.exit(1);
});
