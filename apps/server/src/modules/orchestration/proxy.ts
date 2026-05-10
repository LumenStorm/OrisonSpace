import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../common/env';

export async function registerOrchestrationProxy(app: FastifyInstance) {
  const base = env.AGENT_URL;

  /** Forward the caller's Authorization header to the agent service */
  function forwardHeaders(request: FastifyRequest): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const auth = request.headers.authorization;
    if (typeof auth === 'string') {
      headers.authorization = auth;
    }
    return headers;
  }

  async function relayJson(upstream: Response, reply: import('fastify').FastifyReply) {
    const text = await upstream.text();
    if (!text) {
      return reply.code(upstream.status).send();
    }
    try {
      return reply.code(upstream.status).send(JSON.parse(text));
    } catch {
      return reply.code(upstream.status).type('text/plain').send(text);
    }
  }

  app.post('/v1/orchestration/runs', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/runs`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return relayJson(res, reply);
  });

  app.get('/v1/orchestration/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const res = await fetch(`${base}/v1/orchestration/runs/${encodeURIComponent(runId)}`, {
      headers: forwardHeaders(request),
    });
    return relayJson(res, reply);
  });

  app.post('/v1/orchestration/actions', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/actions`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return relayJson(res, reply);
  });

  // ── Auto-mode forwarding (closes the gap that previously 404'd at server) ──

  app.post('/v1/orchestration/auto-mode', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/auto-mode`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return relayJson(res, reply);
  });

  app.post('/v1/orchestration/auto-mode/actions', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/auto-mode/actions`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return relayJson(res, reply);
  });

  app.get('/v1/orchestration/auto-mode/:autoModeId', async (request, reply) => {
    const { autoModeId } = request.params as { autoModeId: string };
    const res = await fetch(`${base}/v1/orchestration/auto-mode/${encodeURIComponent(autoModeId)}`, {
      headers: forwardHeaders(request),
    });
    return relayJson(res, reply);
  });

  app.post('/v1/orchestration/auto-mode/restore', async (request, reply) => {
    const res = await fetch(`${base}/v1/orchestration/auto-mode/restore`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return relayJson(res, reply);
  });
}
