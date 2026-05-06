import { projectCreateRequestSchema, projectCreateResponseSchema } from '@orison/shared-contracts';
import { API_BASE } from '../constants';
import type { ProjectMeta } from '../store/types';
import { throwIfSessionExpired } from './session';

type EnsureProjectRegistrationInput = {
  token: string;
  project: Pick<ProjectMeta, 'name' | 'type' | 'path'>;
};

export async function ensureProjectRegistration({
  token,
  project,
}: EnsureProjectRegistrationInput): Promise<string> {
  const payload = projectCreateRequestSchema.parse({
    name: project.name,
    type: project.type,
    localFingerprint: project.path,
  });

  const response = await fetch(`${API_BASE}/v1/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  throwIfSessionExpired(response);

  if (!response.ok) {
    throw new Error(`Project registration failed: ${response.status}`);
  }

  const body = await response.json();
  return projectCreateResponseSchema.parse(body).projectId;
}
