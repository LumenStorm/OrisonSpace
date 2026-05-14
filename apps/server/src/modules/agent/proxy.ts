import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../common/env';

export async function registerAgentProxy(app: FastifyInstance) {
  const base = env.AGENT_URL;

  function forwardHeaders(request: FastifyRequest): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const auth = request.headers.authorization;
    if (typeof auth === 'string') {
      headers.authorization = auth;
    }
    return headers;
  }

  async function relayJson(upstream: Response, reply: FastifyReply) {
    const text = await upstream.text();
    if (!text) return reply.code(upstream.status).send();
    try {
      return reply.code(upstream.status).send(JSON.parse(text));
    } catch {
      return reply.code(upstream.status).type('text/plain').send(text);
    }
  }

  app.post('/v1/agent/sessions', async (request, reply) => {
    const res = await fetch(`${base}/v1/agent/sessions`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return relayJson(res, reply);
  });

  app.get('/v1/agent/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await fetch(`${base}/v1/agent/sessions/${encodeURIComponent(id)}`, {
      headers: forwardHeaders(request),
    });
    return relayJson(res, reply);
  });

  app.delete('/v1/agent/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await fetch(`${base}/v1/agent/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: forwardHeaders(request),
    });
    return relayJson(res, reply);
  });

  app.get('/v1/agent/sessions', async (request, reply) => {
    const query = (request.query as Record<string, string>).projectPath;
    const url = query
      ? `${base}/v1/agent/sessions?projectPath=${encodeURIComponent(query)}`
      : `${base}/v1/agent/sessions`;
    const res = await fetch(url, { headers: forwardHeaders(request) });
    return relayJson(res, reply);
  });

  app.post('/v1/agent/sessions/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await fetch(`${base}/v1/agent/sessions/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });
    return relayJson(res, reply);
  });

  app.post('/v1/agent/sessions/:id/skills/:skillName/execute', async (request, reply) => {
    const { id, skillName } = request.params as { id: string; skillName: string };
    const res = await fetch(`${base}/v1/agent/sessions/${encodeURIComponent(id)}/skills/${encodeURIComponent(skillName)}/execute`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body ?? {}),
    });
    return relayJson(res, reply);
  });

  // ── Orchestration proxy (legacy routes still used by desktop UI) ──

  app.get('/v1/agent/skills', async (request, reply) => {
    const query = (request.query as Record<string, string>).projectPath;
    const url = query
      ? `${base}/v1/agent/skills?projectPath=${encodeURIComponent(query)}`
      : `${base}/v1/agent/skills`;
    const res = await fetch(url, { headers: forwardHeaders(request) });
    return relayJson(res, reply);
  });

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

  // SSE stream — pipe through without parsing
  app.post('/v1/agent/sessions/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };
    const origin = request.headers.origin;

    const res = await fetch(`${base}/v1/agent/sessions/${encodeURIComponent(id)}/stream`, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: JSON.stringify(request.body),
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      return reply.code(res.status).type('text/plain').send(text);
    }

    const headers: Record<string, string> = {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    };
    if (origin) {
      headers['access-control-allow-origin'] = origin;
      headers['access-control-allow-credentials'] = 'true';
    }

    reply.raw.writeHead(res.status, headers);

    const reader = res.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
    } finally {
      reply.raw.end();
    }
  });
}
