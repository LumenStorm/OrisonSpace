import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query } from '../../common/db';
import { createToken } from './plugin';

const registerBody = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  password: z.string().min(1),
  displayName: z.string().min(1).optional(),
});

const loginBody = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  password: z.string().min(1),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/v1/auth/me', async (request, reply) => {
    const result = await query(
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [request.userId]
    );

    if (result.rowCount === 0) {
      return reply.code(401).send({ error: 'User not found' });
    }

    const user = result.rows[0];
    return reply.code(200).send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  });

  app.post('/v1/auth/register', async (request, reply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { email, password, displayName } = parsed.data;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount! > 0) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [email, passwordHash, displayName ?? null]
    );

    const user = result.rows[0];
    const token = await createToken(user.id);

    return reply.code(201).send({
      accessToken: token,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { email, password } = parsed.data;

    const result = await query(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rowCount === 0) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = await createToken(user.id);

    return reply.code(200).send({
      accessToken: token,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  });
}

