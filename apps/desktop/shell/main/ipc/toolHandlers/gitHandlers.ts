/**
 * Git tool handlers — git_status, git_log, git_commit, git_diff
 */
import git from 'isomorphic-git';
import fs from 'node:fs';
import { assertSafePath } from '../pathGuard';
import { notifyUI } from '../toolNotify';
import type { ToolHandler } from '../toolExecution';

export const gitStatusHandler: ToolHandler = async ({ projectDir }) => {
  assertSafePath(projectDir);
  const root = await git.findRoot({ fs, filepath: projectDir });
  const matrix = await git.statusMatrix({ fs, dir: root });
  const files = matrix
    .filter(([, head, workdir, stage]) => head !== 1 || workdir !== 1 || stage !== 1)
    .map(([filepath, head, workdir, stage]) => ({ filepath, head, workdir, stage }));

  const lines = files.map((f) => `${f.filepath} [H:${f.head} W:${f.workdir} S:${f.stage}]`);
  return {
    title: 'git_status',
    output: lines.length > 0 ? lines.join('\n') : 'Working tree clean.',
    metadata: { count: files.length },
  };
};

export const gitLogHandler: ToolHandler = async ({ params, projectDir }) => {
  const { depth = 20 } = params as { depth?: number };
  assertSafePath(projectDir);
  const root = await git.findRoot({ fs, filepath: projectDir });
  const commits = await git.log({ fs, dir: root, depth });

  const lines = commits.map((c) =>
    `${c.oid.slice(0, 7)} ${c.commit.message.trim().split('\n')[0]} (${c.commit.author.name})`
  );
  return {
    title: 'git_log',
    output: lines.join('\n'),
    metadata: { count: commits.length },
  };
};

export const gitCommitHandler: ToolHandler = async ({ params, projectDir }) => {
  const { message, author } = params as { message: string; author?: { name: string; email: string } };
  assertSafePath(projectDir);
  const root = await git.findRoot({ fs, filepath: projectDir });

  const matrix = await git.statusMatrix({ fs, dir: root });
  for (const [filepath, , workdir] of matrix) {
    if (workdir !== 1) {
      await git.add({ fs, dir: root, filepath });
    }
  }

  const oid = await git.commit({
    fs,
    dir: root,
    message,
    author: author ?? { name: 'Orison Agent', email: 'agent@orison.local' },
  });

  notifyUI({ type: 'git:changed' });
  return {
    title: 'git_commit',
    output: `Committed: ${oid.slice(0, 7)} — ${message}`,
    metadata: { oid },
  };
};

export const gitDiffHandler: ToolHandler = async ({ params, projectDir }) => {
  const { filepath } = params as { filepath?: string };
  assertSafePath(projectDir);
  const root = await git.findRoot({ fs, filepath: projectDir });
  const matrix = await git.statusMatrix({ fs, dir: root });

  const changed = filepath
    ? matrix.filter(([fp]) => fp === filepath)
    : matrix.filter(([, head, workdir, stage]) => head !== 1 || workdir !== 1 || stage !== 1);

  const lines = changed.map(([fp, head, workdir, stage]) =>
    `${fp} [H:${head} W:${workdir} S:${stage}]`
  );
  return {
    title: 'git_diff',
    output: lines.length > 0 ? lines.join('\n') : 'No changes.',
    metadata: { count: lines.length },
  };
};
