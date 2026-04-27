import type { FastifyInstance } from 'fastify';
import { taskRequestSchema } from '@orison/shared-contracts';
import { enqueueTask, ProjectNotFoundError } from './service';
import { postgresTaskRepository } from './repositories/postgresTaskRepository';

export async function registerTaskRoutes(app: FastifyInstance) {
  app.post('/v1/tasks', async (request, reply) => {
    const payload = taskRequestSchema.parse(request.body);
    try {
      const queuedResult = await enqueueTask(payload);
      return reply.code(202).send({
        taskId: queuedResult.taskId,
        status: queuedResult.status
      });
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        return reply.code(404).send({ message: error.message });
      }
      throw error;
    }
  });

  app.get('/v1/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const stored = await postgresTaskRepository.getTaskResult(taskId);

    if (!stored) {
      return reply.code(404).send({ message: 'Task not found' });
    }

    return reply.send(stored);
  });
}
