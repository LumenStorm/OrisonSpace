import type { FastifyInstance } from 'fastify';
import { projectCreateRequestSchema } from '@orison/shared-contracts';
import { createProject } from './service';

export async function registerProjectRoutes(app: FastifyInstance) {
  app.post('/v1/projects', async (request, reply) => {
    const payload = projectCreateRequestSchema.parse(request.body);
    const project = await createProject(payload);
    return reply.code(201).send(project);
  });
}
