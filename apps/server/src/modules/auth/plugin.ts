import fp from 'fastify-plugin';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../common/env';
import { query } from '../../common/db';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

const TOKEN_EXPIRY = '2h';
const secret = new TextEncoder().encode(env.JWT_SECRET);

async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('userId', '');

  app.addHook('onRequest', async (request, reply) => {
    const isPublic =
      request.url === '/health' ||
      request.url.startsWith('/v1/auth/') ||
      request.url.startsWith('/v1/orchestration/');

    if (isPublic) return;

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing token' });
    }

    const token = header.slice(7);
    const userId = await verifyToken(token);
    if (!userId) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const result = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      return reply.code(401).send({ error: 'User not found' });
    }

    request.userId = userId;
  });
});
