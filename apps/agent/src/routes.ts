import type { FastifyInstance } from 'fastify';
import {
  orchestrationActionSchema,
  startOrchestrationRunSchema,
  creativeRunRequestSchema,
  novelChapterRunRequestSchema,
} from '@orison/shared-contracts';
import { createRunService } from './engine/runService';
import { createActionService } from './engine/actionService';
import { createAutoModeService } from './engine/autoMode/autoModeService';
import { createGuidedNovelSessionService } from './engine/guidedNovel/sessionService';

const runService = createRunService();
const actionService = createActionService();
const autoModeService = createAutoModeService();
const guidedNovelSessionService = createGuidedNovelSessionService();

export async function registerOrchestrationRoutes(app: FastifyInstance) {
  app.post('/v1/guided-novel/sessions', async (request, reply) => {
    const state = await guidedNovelSessionService.start(request.body);
    return reply.code(202).send(state);
  });

  app.post('/v1/guided-novel/sessions/restore', async (request, reply) => {
    try {
      const state = guidedNovelSessionService.restore(request.body);
      return reply.send(state);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'unknown error' });
    }
  });

  app.get('/v1/guided-novel/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const state = guidedNovelSessionService.get(sessionId);
    if (!state) {
      return reply.code(404).send({ error: `guided novel session not found: ${sessionId}` });
    }
    return reply.send(state);
  });

  app.post('/v1/guided-novel/sessions/:sessionId/interview', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const state = await guidedNovelSessionService.submitInterviewAnswer(sessionId, request.body);
      return reply.send(state);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : 'unknown error' });
    }
  });

  app.post('/v1/guided-novel/sessions/:sessionId/chapters/next', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const state = await guidedNovelSessionService.confirmPlanning(sessionId);
      return reply.send(state);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : 'unknown error' });
    }
  });

  app.post('/v1/guided-novel/sessions/:sessionId/chapter/approve', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const state = guidedNovelSessionService.approveChapter(sessionId);
      return reply.send(state);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : 'unknown error' });
    }
  });

  app.post('/v1/guided-novel/sessions/:sessionId/change-review/accept', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const state = guidedNovelSessionService.acceptChangeReview(sessionId, request.body);
      return reply.send(state);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : 'unknown error' });
    }
  });

  app.post('/v1/orchestration/runs', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // 检测是否为小说章节 run（包含 chapterId + mode）
    if ('chapterId' in body && 'mode' in body) {
      const novelRequest = novelChapterRunRequestSchema.parse(body);
      const run = await runService.startNovelChapter(novelRequest);
      return reply.code(202).send(run);
    }

    // 检测是否为新格式（包含 runIntent 或 targetFields）
    if ('runIntent' in body || 'targetFields' in body || 'constraints' in body) {
      const creativeRequest = creativeRunRequestSchema.parse(body);
      const run = await runService.startCreative(creativeRequest);
      return reply.code(202).send(run);
    }

    // 兼容旧格式
    const command = startOrchestrationRunSchema.parse(body);
    const run = await runService.start(command);
    return reply.code(202).send(run);
  });

  app.get('/v1/orchestration/runs/:runId', async (request) => {
    const { runId } = request.params as { runId: string };
    return runService.get(runId);
  });

  app.post('/v1/orchestration/actions', async (request, reply) => {
    const action = orchestrationActionSchema.parse(request.body);

    switch (action.action) {
      case 'accept_current':
        return reply.send(await actionService.acceptCurrent(action.runId));
      case 'edit_and_resume':
        return reply.send(
          await actionService.editAndResume(action.runId, (action.payload ?? {}) as Record<string, unknown>)
        );
      case 'rerun_from_node':
        if (!action.nodeId) return reply.code(400).send({ error: 'nodeId is required for rerun_from_node' });
        return reply.send(await actionService.rerunFromNode(action.runId, action.nodeId));
      case 'abort_run':
        return reply.send(await actionService.abortRun(action.runId));
    }
  });

  // ── Auto Mode (Phase 6) ──

  app.post('/v1/orchestration/auto-mode', async (request, reply) => {
    const state = await autoModeService.start(request.body);
    return reply.code(202).send(state);
  });

  app.post('/v1/orchestration/auto-mode/actions', async (request, reply) => {
    try {
      const state = await autoModeService.applyAction(request.body);
      return reply.send(state);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : 'unknown error' });
    }
  });

  app.get('/v1/orchestration/auto-mode/:autoModeId', async (request, reply) => {
    const { autoModeId } = request.params as { autoModeId: string };
    const state = autoModeService.getState(autoModeId);
    if (!state) {
      return reply.code(404).send({ error: `auto mode session not found: ${autoModeId}` });
    }
    return reply.send(state);
  });

  app.post('/v1/orchestration/auto-mode/restore', async (request, reply) => {
    const body = request.body as { projectPath?: unknown };
    const projectPath = typeof body?.projectPath === 'string' ? body.projectPath : '';
    if (!projectPath) {
      return reply.code(400).send({ error: 'projectPath is required' });
    }
    const states = autoModeService.restoreFromProject(projectPath);
    return reply.send({ restored: states });
  });
}
