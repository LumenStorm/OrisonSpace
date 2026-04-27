import type { ProjectRecord } from './projectReadRepository';

export type CreateProjectInput = {
  name: string;
  type: 'novel' | 'script';
  localFingerprint: string;
};

export interface ProjectWriteRepository {
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
}
