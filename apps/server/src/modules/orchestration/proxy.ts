import type { FastifyInstance } from 'fastify';
import { env } from '../../common/env';

export async function registerOrchestrationProxy(app: FastifyInstance) {
  const base = env.AGENT_URL;

  /** Forward the caller's Authorization header to the agent service */
  function forwardHeaders(request: { headers: Record<string, string | string[] | undefined> }): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const auth = request.headers.authorization;
    if (typeof auth === 'string') {
      headers.authorization = auth;
    }
    return headers;
  }

  app.post('/v1/orchestration/runs', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/runs`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return reply.code(res.status).send(await res.json());
  });

  app.get('/v1/orchestration/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const res = await fetch(`${base}/v1/orchestration/runs/${runId}`, {
      headers: forwardHeaders(request),
    });
    return reply.code(res.status).send(await res.json());
  });

  app.post('/v1/orchestration/actions', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/actions`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return reply.code(res.status).send(await res.json());
  });
}
