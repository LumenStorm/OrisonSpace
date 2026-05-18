import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registry } from './tool/registry';
import { createWorkflowRuntime, isSessionNotFoundError, type WorkflowRuntimeOptions } from './runtime/workflow';
import { loadRuntimeConfig } from './runtime/config';

const createSessionSchema = z.object({
  agentName: z.string().default('writer'),
  projectPath: z.string(),
  mode: z.string().optional(),
  modelRef: z.object({ keyId: z.string(), modelId: z.string() }).optional(),
});

const sendMessageSchema = z.object({
  content: z.string(),
});

const executeSkillSchema = z.object({
  input: z.string().optional(),
  artifactIds: z.array(z.string()).optional(),
  referenceIds: z.array(z.string()).optional(),
});

const confirmSchema = z.object({
  callId: z.string(),
  approved: z.boolean(),
});

const restoreContinuationSchema = z.object({
  continuationId: z.string(),
});

export async function registerRoutes(app: FastifyInstance, options: { runtime?: WorkflowRuntimeOptions } = {}) {
  const runtime = createWorkflowRuntime(options.runtime);

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/agent/sessions', async (request, reply) => {
    const body = createSessionSchema.parse(request.body);
    const runtimeConfig = await loadRuntimeConfig(body.projectPath);
    const sessionRuntime = createWorkflowRuntime({
      ...options.runtime,
      externalSkillRoots: [
        ...(options.runtime?.externalSkillRoots ?? []),
        ...runtimeConfig.externalSkillRoots,
      ],
    });
    const session = sessionRuntime.createSession(body);
    return reply.code(201).send(session);
  });

  app.get('/v1/agent/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { projectPath } = request.query as { projectPath?: string };
    const session = runtime.getSession(id, projectPath);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    return session;
  });

  app.get('/v1/agent/sessions', async (request) => {
    const { projectPath } = request.query as { projectPath?: string };
    return runtime.listSessions(projectPath);
  });

  app.delete('/v1/agent/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    runtime.deleteSession(id);
    return reply.code(204).send();
  });

  app.post('/v1/agent/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content } = sendMessageSchema.parse(request.body);

    const abortController = new AbortController();
    request.raw.socket.on('close', () => abortController.abort());

    try {
      const payload = await runtime.sendMessage({
        sessionId: id,
        content,
        abortSignal: abortController.signal,
      });
      return reply.send(payload);
    } catch (err) {
      if (isSessionNotFoundError(err)) {
        return reply.code(404).send({ error: 'session not found' });
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: errMsg });
    }
  });

  app.post('/v1/agent/sessions/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { callId, approved } = confirmSchema.parse(request.body);

    try {
      const result = runtime.resolveConfirmation(id, callId, approved);
      return reply.send(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.code(404).send({ error: errMsg });
    }
  });

  app.post('/v1/agent/sessions/:id/skills/:skillName/execute', async (request, reply) => {
    const { id, skillName } = request.params as { id: string; skillName: string };
    const payload = executeSkillSchema.parse(request.body ?? {});

    try {
      const result = await runtime.executeSkillByName(id, skillName, payload);
      return reply.send(result);
    } catch (err) {
      if (isSessionNotFoundError(err)) {
        return reply.code(404).send({ error: 'session not found' });
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: errMsg });
    }
  });

  app.get('/v1/agent/sessions/:id/continuations', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const continuations = runtime.listContinuations(id);
      return reply.send({ continuations });
    } catch (err) {
      if (isSessionNotFoundError(err)) {
        return reply.code(404).send({ error: 'session not found' });
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: errMsg });
    }
  });

  app.post('/v1/agent/sessions/:id/continuations/restore', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { continuationId } = restoreContinuationSchema.parse(request.body ?? {});
    try {
      const restored = runtime.restoreContinuation(id, continuationId);
      return reply.send({ restored });
    } catch (err) {
      if (isSessionNotFoundError(err)) {
        return reply.code(404).send({ error: 'session not found' });
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg === 'continuation not found') {
        return reply.code(404).send({ error: errMsg });
      }
      return reply.code(500).send({ error: errMsg });
    }
  });

  app.post('/v1/agent/sessions/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content } = sendMessageSchema.parse(request.body);
    const session = runtime.getSession(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });

    const abortController = new AbortController();
    request.raw.socket.on('close', () => abortController.abort());

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    function sendEvent(type: string, data: unknown) {
      reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    try {
      await runtime.streamMessage({
        sessionId: session.id,
        content,
        abortSignal: abortController.signal,
        sendEvent: (event) => {
          sendEvent(event.type, event.data);
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      sendEvent('error', { message: errMsg });
    }

    reply.raw.end();
  });

  app.get('/v1/agent/tools', async () => {
    return {
      tools: registry.all().map((tool) => ({
        id: tool.id,
        description: tool.description,
      })),
    };
  });

  app.get('/v1/agent/skills', async (request) => {
    const { projectPath } = request.query as { projectPath?: string };
    if (!projectPath) return { skills: [] };
    const skills = await runtime.listSkills(projectPath);
    return { skills };
  });
}
