import { app } from './app.js';
import { env } from './config/env.js';
import { connectMongoWithRetry } from './config/db.js';

async function bootstrap() {
  await connectMongoWithRetry();
  app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap server', error);
  process.exit(1);
});
