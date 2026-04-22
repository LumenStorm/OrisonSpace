import type { FastifyInstance } from 'fastify';
import { taskRequestSchema } from '@orison/shared-contracts';
import { enqueueTask } from './service';
import { taskStore } from './store';

export async function registerTaskRoutes(app: FastifyInstance) {
  app.post('/v1/tasks', async (request, reply) => {
    const payload = taskRequestSchema.parse(request.body);
    enqueueTask(payload);

    return reply.code(202).send({
      taskId: payload.taskId,
      status: 'queued'
    });
  });

  app.get('/v1/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const stored = taskStore.get(taskId);

    if (!stored) {
      return reply.code(404).send({ message: 'Task not found' });
    }

    return reply.send(stored.result);
  });
}
