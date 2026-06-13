import type { ProjectMeta } from '../store/types';

type EnsureProjectRegistrationInput = {
  project: Pick<ProjectMeta, 'name' | 'type' | 'path' | 'coverImage'>;
};

export async function ensureProjectRegistration({
  project,
}: EnsureProjectRegistrationInput): Promise<string> {
  const result = await window.orisonDesktop!.ensureProjectRegistration({
    name: project.name,
    type: project.type,
    localFingerprint: project.path,
    path: project.path,
    coverImage: project.coverImage,
  });
  return result.projectId;
}

/** Bump last-opened time so the registry list orders most-recent first. Best-effort. */
export async function touchProjectRegistration(project: Pick<ProjectMeta, 'path' | 'coverImage'>): Promise<void> {
  try {
    await window.orisonDesktop?.touchProjectRegistration({
      localFingerprint: project.path,
      coverImage: project.coverImage,
    });
  } catch {
    // Registry touch is non-critical (ordering only); ignore transient failures.
  }
}
