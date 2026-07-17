import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allowPath, assertSafePath, assertWithinProject, revokePath } from '../main/ipc/pathGuard';

describe('path guard', () => {
  it('allows paths that were selected by the user for project-scoped operations', () => {
    const projectDir = allowPath(path.resolve('C:/projects/cold-city'));

    expect(() => assertSafePath(projectDir)).not.toThrow();
    expect(() => assertSafePath(path.join(projectDir, 'temp', 'images', 'frame.png'))).not.toThrow();
    expect(() => assertWithinProject(projectDir, path.join(projectDir, 'assets', 'images', 'frame.png'))).not.toThrow();
  });

  it('still rejects sibling directory traversal from an allowed project', () => {
    const projectDir = allowPath(path.resolve('C:/projects/cold-city'));
    const sibling = path.resolve(projectDir, '..', 'other-project', 'frame.png');

    expect(() => assertWithinProject(projectDir, sibling)).toThrow('Path escapes project directory');
  });

  it('revokes explicit access after an external project is deleted', () => {
    const projectDir = allowPath(path.resolve('C:/projects/to-delete'));
    revokePath(projectDir);

    expect(() => assertSafePath(projectDir)).toThrow('Path outside allowed scope');
  });
});
