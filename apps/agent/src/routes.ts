import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSession, getSession, deleteSession, addMessage, updateStatus, loadSession } from './agent/session';
import { listSessions } from './agent/persistence';
import { runLoop } from './agent/loop';
import { generate } from './provider/ipc-provider';
import { registry } from './tool/registry';
import { buildSystemPrompt } from './prompt/render';
import { discoverSkills } from './skill/discovery';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { logger } from './logger';

const createSessionSchema = z.object({
  agentName: z.string().default('writer'),
  projectPath: z.string(),
  mode: z.string().optional(),
  modelRef: z.object({ keyId: z.string(), modelId: z.string() }).optional(),
});

const sendMessageSchema = z.object({
  content: z.string(),
});

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }));

  // ── Session API ──

  app.post('/v1/agent/sessions', async (request, reply) => {
    const body = createSessionSchema.parse(request.body);
    const session = createSession(body.agentName, body.projectPath, body.modelRef);
    return reply.code(201).send(session);
  });

  app.get('/v1/agent/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { projectPath } = request.query as { projectPath?: string };
    const session = getSession(id) ?? (projectPath ? loadSession(id, projectPath) : undefined);
    if (!session) return reply.code(404).send({ error: 'session not found' });
    return session;
  });

  app.get('/v1/agent/sessions', async (request) => {
    const { projectPath } = request.query as { projectPath?: string };
    if (!projectPath) return { sessions: [] };
    return { sessions: listSessions(projectPath) };
  });

  app.delete('/v1/agent/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteSession(id);
    return reply.code(204).send();
  });

  app.post('/v1/agent/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = getSession(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });

    const { content } = sendMessageSchema.parse(request.body);

    const userMsg = {
      id: randomUUID(),
      role: 'user' as const,
      content,
      createdAt: Date.now(),
    };
    addMessage(id, userMsg);
    updateStatus(id, 'running');

    const abortController = new AbortController();
    request.raw.socket.on('close', () => abortController.abort());

    try {
      const skillsDir = path.join(session.projectPath, '.orison', 'skills');
      const skills = await discoverSkills(skillsDir);
      const skillsSummary = skills.length > 0
        ? '## Available Skills\n' + skills.map(s => `- **${s.name}**: ${s.description ?? 'no description'}`).join('\n')
        : undefined;

      const systemPrompt = buildSystemPrompt({
        orisonPrompt: 'You are Orison, an AI writing assistant for creative fiction.',
        projectMeta: `Project path: ${session.projectPath}`,
        skillsSummary,
        toolDescriptions: registry.all().map(t => `- ${t.id}: ${t.description}`).join('\n'),
      });

      const tools = registry.all();
      const newMessages = await runLoop({
        sessionId: id,
        projectPath: session.projectPath,
        messages: session.messages,
        systemPrompt,
        tools,
        maxSteps: 50,
        generate: (msgs, sys, tls) => generate(msgs, sys, tls, { modelRef: session.modelRef }),
        onMessage: (msg) => addMessage(id, msg),
        abort: abortController.signal,
      });

      updateStatus(id, 'completed');
      return reply.send({ messages: newMessages });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ sessionId: id, err: errMsg }, 'session run failed');
      updateStatus(id, 'error', errMsg);
      return reply.code(500).send({ error: errMsg });
    }
  });

  // ── SSE Streaming endpoint ──

  app.post('/v1/agent/sessions/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = getSession(id);
    if (!session) return reply.code(404).send({ error: 'session not found' });

    const { content } = sendMessageSchema.parse(request.body);

    const userMsg = {
      id: randomUUID(),
      role: 'user' as const,
      content,
      createdAt: Date.now(),
    };
    addMessage(id, userMsg);
    updateStatus(id, 'running');

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
      const skillsDir = path.join(session.projectPath, '.orison', 'skills');
      const skills = await discoverSkills(skillsDir);
      const skillsSummary = skills.length > 0
        ? '## Available Skills\n' + skills.map(s => `- **${s.name}**: ${s.description ?? 'no description'}`).join('\n')
        : undefined;

      const systemPrompt = buildSystemPrompt({
        orisonPrompt: 'You are Orison, an AI writing assistant for creative fiction.',
        projectMeta: `Project path: ${session.projectPath}`,
        skillsSummary,
        toolDescriptions: registry.all().map(t => `- ${t.id}: ${t.description}`).join('\n'),
      });

      const tools = registry.all();
      await runLoop({
        sessionId: id,
        projectPath: session.projectPath,
        messages: session.messages,
        systemPrompt,
        tools,
        maxSteps: 50,
        generate: (msgs, sys, tls) => generate(msgs, sys, tls, { modelRef: session.modelRef }),
        onMessage: (msg) => {
          addMessage(id, msg);
          if (msg.role === 'assistant') {
            sendEvent('assistant', { id: msg.id, content: msg.content, toolCalls: msg.toolCalls });
          } else if (msg.role === 'tool') {
            sendEvent('tool', { id: msg.id, results: msg.toolResults });
          }
        },
        abort: abortController.signal,
      });

      updateStatus(id, 'completed');
      sendEvent('done', { status: 'completed' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error({ sessionId: id, err: errMsg }, 'stream run failed');
      updateStatus(id, 'error', errMsg);
      sendEvent('error', { message: errMsg });
    }

    reply.raw.end();
  });

  // ── Tools listing ──

  app.get('/v1/agent/tools', async () => {
    return {
      tools: registry.all().map(t => ({
        id: t.id,
        description: t.description,
      })),
    };
  });

  // ── Skills API ──

  app.get('/v1/agent/skills', async (request) => {
    const { projectPath } = request.query as { projectPath?: string };
    if (!projectPath) return { skills: [] };
    const skillsDir = path.join(projectPath, '.orison', 'skills');
    const skills = await discoverSkills(skillsDir);
    return { skills };
  });
}
