import cors from '@fastify/cors';
import Fastify from 'fastify';
import { initDatabase } from './common/db';
import { env } from './common/env';
import { registerHealthRoutes } from './common/health';
import { logger } from './common/logger';
import { authPlugin } from './modules/auth/plugin';
import { registerAuthRoutes } from './modules/auth/routes';
import { registerAgentProxy } from './modules/agent/proxy';

export function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    bodyLimit: 1_048_576
  });

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:43117',
    'http://127.0.0.1:43117',
    'app://.',
  ];

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });

  // Chromium Private Network Access: required for Electron renderer → localhost fetch
  app.addHook('onSend', (request, reply, _payload, done) => {
    if (request.headers['access-control-request-private-network']) {
      reply.header('Access-Control-Allow-Private-Network', 'true');
    }
    done();
  });

  app.register(authPlugin);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerAgentProxy);

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
