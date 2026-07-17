import type { ProjectLifecycleResult } from '@orison/shared-contracts';
import type { ProjectMeta } from '../store/types';

type EnsureProjectRegistrationInput = {
  project: Pick<ProjectMeta, 'projectId' | 'name' | 'type' | 'path' | 'coverImage'>;
};

export async function ensureProjectRegistration({
  project,
}: EnsureProjectRegistrationInput): Promise<string> {
  const result = await window.orisonDesktop!.ensureProjectRegistration({
    projectId: project.projectId,
    name: project.name,
    type: project.type,
    localFingerprint: project.path,
    path: project.path,
    coverImage: project.coverImage,
  });
  return result.projectId;
}

/** Bump last-opened time so the registry list orders most-recent first. Best-effort. */
async function _touchProjectRegistration(project: Pick<ProjectMeta, 'path' | 'coverImage'>): Promise<void> {
  try {
    await window.orisonDesktop?.touchProjectRegistration({
      localFingerprint: project.path,
      coverImage: project.coverImage,
    });
  } catch {
    // Registry touch is non-critical (ordering only); ignore transient failures.
  }
}

export function duplicateProject(projectPath: string, name: string): Promise<ProjectLifecycleResult> {
  return window.orisonDesktop!.duplicateProject(projectPath, name);
}

export function renameProject(projectPath: string, name: string): Promise<ProjectLifecycleResult> {
  return window.orisonDesktop!.renameProject(projectPath, name);
}

export function deleteProject(projectPath: string): Promise<ProjectLifecycleResult> {
  return window.orisonDesktop!.deleteProject(projectPath);
}
