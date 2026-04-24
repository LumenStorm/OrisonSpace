import cors from '@fastify/cors';
import Fastify from 'fastify';
import { env } from './common/env';
import { logger } from './common/logger';
import { registerOrchestrationRoutes } from './routes';

export function buildAgent() {
  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: 1_048_576
  });

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.register(registerOrchestrationRoutes);

  return app;
}

if (process.env.VITEST !== 'true') {
  const app = buildAgent();

  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
