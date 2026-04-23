import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import { env } from '../../common/env';
import { query } from '../../common/db';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

function verifyToken(token: string): string | null {
  try {
    const payload = Buffer.from(token, 'base64url').toString();
    const parsed = JSON.parse(payload);
    if (parsed.secret !== env.JWT_SECRET) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

export function createToken(userId: string): string {
  const payload = JSON.stringify({ userId, secret: env.JWT_SECRET, iat: Date.now() });
  return Buffer.from(payload).toString('base64url');
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('userId', '');

  app.addHook('onRequest', async (request, reply) => {
    const isPublic =
      request.url === '/health' ||
      request.url.startsWith('/v1/auth/');

    if (isPublic) return;

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing token' });
    }

    const token = header.slice(7);
    const userId = verifyToken(token);
    if (!userId) {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    const result = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      return reply.code(401).send({ error: 'User not found' });
    }

    request.userId = userId;
  });
});
