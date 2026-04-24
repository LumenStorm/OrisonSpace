import cors from '@fastify/cors';
import Fastify from 'fastify';
import { initDatabase } from './common/db';
import { env } from './common/env';
import { registerHealthRoutes } from './common/health';
import { logger } from './common/logger';
import { authPlugin } from './modules/auth/plugin';
import { registerAuthRoutes } from './modules/auth/routes';
import { registerTaskRoutes } from './modules/task/routes';

export function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: 1_048_576
  });

  app.register(cors, {
    origin: true,
    credentials: true
  });

  app.register(authPlugin);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerTaskRoutes);

  return app;
}

if (process.env.VITEST !== 'true') {
  const app = buildServer();

  initDatabase()
    .then(() => app.listen({ port: env.PORT, host: '0.0.0.0' }))
    .catch((error) => {
      app.log.error(error);
      process.exit(1);
    });
}
