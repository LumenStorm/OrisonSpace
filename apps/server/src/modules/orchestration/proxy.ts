import type { FastifyInstance } from 'fastify';
import { env } from '../../common/env';

export async function registerOrchestrationProxy(app: FastifyInstance) {
  const base = env.AGENT_URL;

  app.post('/v1/orchestration/runs', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    return reply.code(res.status).send(await res.json());
  });

  app.get('/v1/orchestration/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const res = await fetch(`${base}/v1/orchestration/runs/${runId}`);
    return reply.code(res.status).send(await res.json());
  });

  app.post('/v1/orchestration/actions', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    return reply.code(res.status).send(await res.json());
  });
}
