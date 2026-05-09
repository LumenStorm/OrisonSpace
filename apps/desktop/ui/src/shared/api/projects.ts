import type { ProjectMeta } from '../store/types';

type EnsureProjectRegistrationInput = {
  token: string;
  project: Pick<ProjectMeta, 'name' | 'type' | 'path'>;
};

export async function ensureProjectRegistration({
  project,
}: EnsureProjectRegistrationInput): Promise<string> {
  const result = await window.orisonDesktop!.ensureProjectRegistration({
    name: project.name,
    type: project.type,
    localFingerprint: project.path,
  });
  return result.projectId;
}
