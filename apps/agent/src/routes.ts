import type { FastifyInstance } from 'fastify';
import { orchestrationActionSchema, startOrchestrationRunSchema, creativeRunRequestSchema } from '@orison/shared-contracts';
import { createRunService } from './engine/runService';
import { createActionService } from './engine/actionService';

const runService = createRunService();
const actionService = createActionService();

export async function registerOrchestrationRoutes(app: FastifyInstance) {
  app.post('/v1/orchestration/runs', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

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
}
