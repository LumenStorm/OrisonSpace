import type { z } from 'zod';
import { projectCreateRequestSchema, projectCreateResponseSchema } from '@orison/shared-contracts';
import { postgresProjectRepository } from './repositories/postgresProjectRepository';

type CreateProjectRequest = z.infer<typeof projectCreateRequestSchema>;

export async function createProject(input: CreateProjectRequest) {
  const project = await postgresProjectRepository.createProject(input);

  return projectCreateResponseSchema.parse({
    projectId: project.projectId,
    name: project.name,
    type: project.type
  });
}
