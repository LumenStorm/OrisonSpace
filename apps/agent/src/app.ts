import cors from '@fastify/cors';
import Fastify from 'fastify';
import { env } from './env';
import { logger } from './logger';
import { registerRoutes } from './routes';
import { registerBuiltinTools } from './tool/builtin';
import type { WorkflowRuntimeOptions } from './runtime/workflow';

export function buildAgent(options: { runtime?: WorkflowRuntimeOptions } = {}) {
  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: 2_097_152,
  });

  app.register(cors, { origin: true, credentials: true });
  app.register(registerRoutes, { runtime: options.runtime });

  registerBuiltinTools();

  return app;
}

if (process.env.VITEST !== 'true') {
  const app = buildAgent();

  app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
