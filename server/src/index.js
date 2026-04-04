import { app } from './app.js';
import { env, validateEnv } from './config/env.js';
import { connectMongoWithRetry } from './config/db.js';
import { logger } from './utils/logger.js';
import { ensureDefaultAdmin } from './utils/initDefaultAdmin.js';
import { runDockerSmokeTests } from './utils/dockerSmokeTest.js';

async function bootstrap() {
  validateEnv();
  await connectMongoWithRetry();
  await ensureDefaultAdmin();

  app.listen(env.port, async () => {
    logger.info('Server started', { url: `http://localhost:${env.port}` });

    // Run smoke tests if enabled (Docker deployments)
    if (env.runSmokeTests === 'true') {
      // Give the server a moment to be fully ready
      setTimeout(() => {
        runDockerSmokeTests().catch((error) => {
          logger.error('Smoke tests failed', { message: error.message });
        });
      }, 3000);
    }
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap server', { message: error.message, stack: error.stack });
  process.exit(1);
});
