import type { FastifyInstance } from 'fastify';
import { orchestrationActionSchema, startOrchestrationRunSchema } from '@orison/shared-contracts';
import { createRunService } from './engine/runService';

const runService = createRunService();

export async function registerOrchestrationRoutes(app: FastifyInstance) {
  app.post('/v1/orchestration/runs', async (request, reply) => {
    const command = startOrchestrationRunSchema.parse(request.body);
    const run = await runService.start(command);
    return reply.code(202).send(run);
  });

  app.get('/v1/orchestration/runs/:runId', async (request) => {
    const { runId } = request.params as { runId: string };
    return runService.get(runId);
  });

  app.post('/v1/orchestration/actions', async (request, reply) => {
    const action = orchestrationActionSchema.parse(request.body);
    return reply.code(501).send({
      message: `Action not implemented yet: ${action.action}`
    });
  });
}
