import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../common/env';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/v1/auth/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    return reply.send({
      accessToken: env.DEMO_ACCESS_TOKEN,
      tokenType: 'Bearer',
      user: {
        id: 'user_demo',
        email: body.email,
        displayName: 'Demo Creator'
      }
    });
  });
}
