import { ipcMain, BrowserWindow } from 'electron';
import git from 'isomorphic-git';
import fs from 'node:fs';
import { assertSafePath } from './pathGuard';
import { getLogger } from '../logger';
import type { GitCommitEntry, GitFileDiff } from '@orison/shared-contracts';

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await git.findRoot({ fs, filepath: dir });
    return true;
  } catch {
    return false;
  }
}

async function getGitRoot(dir: string): Promise<string> {
  return git.findRoot({ fs, filepath: dir });
}

async function listCommits(dir: string, depth: number): Promise<GitCommitEntry[]> {
  const root = await getGitRoot(dir);

  // Collect commits from all branches for full graph
  const branchNames = await git.listBranches({ fs, dir: root });
  const seen = new Set<string>();
  const allEntries: Array<{ oid: string; commit: { message: string; author: { name: string; timestamp: number }; parent: string[] } }> = [];

  for (const branch of branchNames) {
    try {
      const logs = await git.log({ fs, dir: root, ref: branch, depth });
      for (const entry of logs) {
        if (!seen.has(entry.oid)) {
          seen.add(entry.oid);
          allEntries.push(entry);
        }
      }
    } catch { /* skip unresolvable branches */ }
  }

  // Sort by timestamp descending
  allEntries.sort((a, b) => b.commit.author.timestamp - a.commit.author.timestamp);

  // Build oid -> tag map
  const tags = await git.listTags({ fs, dir: root });
  const tagMap = new Map<string, string>();
  for (const tag of tags) {
    try {
      const resolved = await git.resolveRef({ fs, dir: root, ref: `refs/tags/${tag}` });
      tagMap.set(resolved, tag);
    } catch { /* skip */ }
  }

  return allEntries.map((entry) => ({
    oid: entry.oid,
    parents: entry.commit.parent,
    message: entry.commit.message.trim(),
    author: entry.commit.author.name,
    timestamp: entry.commit.author.timestamp,
    tag: tagMap.get(entry.oid),
  }));
}

async function getCommitDiff(dir: string, oid: string): Promise<GitFileDiff[]> {
  const root = await getGitRoot(dir);
  const commit = await git.readCommit({ fs, dir: root, oid });
  const parentOid = commit.commit.parent[0] ?? undefined;

  const currentTree = git.TREE({ ref: oid });
  const parentTree = parentOid ? git.TREE({ ref: parentOid }) : undefined;

  const trees = parentTree ? [parentTree, currentTree] : [currentTree];
  const results: GitFileDiff[] = [];

  await git.walk({
    fs,
    dir: root,
    trees,
    map: async (filepath, entries) => {
      if (!entries || filepath === '.') return;
      if (parentTree) {
        const [parent, current] = entries;
        const parentOidVal = parent ? await parent.oid() : null;
        const currentOidVal = current ? await current.oid() : null;
        if (parentOidVal === currentOidVal) return;
        if (!parentOidVal && currentOidVal) {
          results.push({ filepath, status: 'added' });
        } else if (parentOidVal && !currentOidVal) {
          results.push({ filepath, status: 'deleted' });
        } else {
          results.push({ filepath, status: 'modified' });
        }
      } else {
        const [current] = entries;
        if (current && (await current.type()) === 'blob') {
          results.push({ filepath, status: 'added' });
        }
      }
    },
  });

  return results;
}

async function getFileAtCommit(dir: string, oid: string, filepath: string): Promise<string | null> {
  const root = await getGitRoot(dir);
  try {
    const { blob } = await git.readBlob({
      fs,
      dir: root,
      oid,
      filepath,
    });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

function notifyGitChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('tool:event', { type: 'git:changed' });
  }
}

/**
 * Initialize version management for a project folder that isn't a repo yet
 * (e.g. an imported existing directory). Creates the repo, stages everything
 * currently on disk, and lays down a first node so the timeline has a starting
 * point. Idempotent: if the folder is already a repo, returns without error.
 */
async function initRepo(dir: string): Promise<{ initialized: boolean }> {
  if (await isGitRepo(dir)) {
    return { initialized: false };
  }
  await git.init({ fs, dir, defaultBranch: 'main' });
  const matrix = await git.statusMatrix({ fs, dir });
  for (const [filepath, , workdir] of matrix) {
    if (workdir !== 1) {
      await git.add({ fs, dir, filepath });
    }
  }
  await git.commit({
    fs,
    dir,
    message: '开启版本管理',
    author: { name: 'Orison', email: 'user@orison.local' },
  });
  notifyGitChanged();
  return { initialized: true };
}

async function createNode(dir: string, message: string, tag?: string): Promise<{ oid: string }> {
  const root = await getGitRoot(dir);
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
    author: { name: 'Orison', email: 'user@orison.local' },
  });
  if (tag) {
    await git.tag({ fs, dir: root, ref: tag, object: oid });
  }
  notifyGitChanged();
  return { oid };
}

async function listBranches(dir: string): Promise<string[]> {
  const root = await getGitRoot(dir);
  return git.listBranches({ fs, dir: root });
}

async function currentBranch(dir: string): Promise<string> {
  const root = await getGitRoot(dir);
  const branch = await git.currentBranch({ fs, dir: root });
  return branch ?? 'HEAD';
}

async function createBranch(dir: string, name: string, fromOid?: string): Promise<void> {
  const root = await getGitRoot(dir);
  await git.branch({ fs, dir: root, ref: name, object: fromOid });
}

async function checkoutBranch(dir: string, name: string): Promise<void> {
  const root = await getGitRoot(dir);
  await git.checkout({ fs, dir: root, ref: name });
  notifyGitChanged();
}

async function statusCount(dir: string): Promise<number> {
  const root = await getGitRoot(dir);
  const matrix = await git.statusMatrix({ fs, dir: root });
  let count = 0;
  for (const [, head, workdir, stage] of matrix) {
    if (head !== 1 || workdir !== 1 || stage !== 1) count++;
  }
  return count;
}

export function registerGitIpc() {
  const logger = getLogger();

  ipcMain.handle('git:is-repo', async (_e, dir: string) => {
    try {
      assertSafePath(dir);
      return await isGitRepo(dir);
    } catch (err) {
      logger.warn({ dir, err }, 'git:is-repo failed');
      return false;
    }
  });

  ipcMain.handle('git:init', async (_e, dir: string) => {
    try {
      assertSafePath(dir);
      return await initRepo(dir);
    } catch (err) {
      logger.warn({ dir, err }, 'git:init failed');
      throw err;
    }
  });

  ipcMain.handle('git:log', async (_e, dir: string, depth?: number) => {
    try {
      assertSafePath(dir);
      return await listCommits(dir, depth ?? 50);
    } catch (err) {
      logger.warn({ dir, err }, 'git:log failed');
      return [];
    }
  });

  ipcMain.handle('git:commit-diff', async (_e, dir: string, oid: string) => {
    try {
      assertSafePath(dir);
      return await getCommitDiff(dir, oid);
    } catch (err) {
      logger.warn({ dir, oid, err }, 'git:commit-diff failed');
      return [];
    }
  });

  ipcMain.handle('git:file-at-commit', async (_e, dir: string, oid: string, filepath: string) => {
    try {
      assertSafePath(dir);
      return await getFileAtCommit(dir, oid, filepath);
    } catch (err) {
      logger.warn({ dir, oid, filepath, err }, 'git:file-at-commit failed');
      return null;
    }
  });

  ipcMain.handle('git:create-node', async (_e, dir: string, message: string, tag?: string) => {
    try {
      assertSafePath(dir);
      return await createNode(dir, message, tag);
    } catch (err) {
      logger.warn({ dir, err }, 'git:create-node failed');
      throw err;
    }
  });

  ipcMain.handle('git:list-branches', async (_e, dir: string) => {
    try {
      assertSafePath(dir);
      return await listBranches(dir);
    } catch (err) {
      logger.warn({ dir, err }, 'git:list-branches failed');
      return [];
    }
  });

  ipcMain.handle('git:current-branch', async (_e, dir: string) => {
    try {
      assertSafePath(dir);
      return await currentBranch(dir);
    } catch (err) {
      logger.warn({ dir, err }, 'git:current-branch failed');
      return 'HEAD';
    }
  });

  ipcMain.handle('git:create-branch', async (_e, dir: string, name: string, fromOid?: string) => {
    try {
      assertSafePath(dir);
      await createBranch(dir, name, fromOid);
    } catch (err) {
      logger.warn({ dir, name, err }, 'git:create-branch failed');
      throw err;
    }
  });

  ipcMain.handle('git:checkout-branch', async (_e, dir: string, name: string) => {
    try {
      assertSafePath(dir);
      await checkoutBranch(dir, name);
    } catch (err) {
      logger.warn({ dir, name, err }, 'git:checkout-branch failed');
      throw err;
    }
  });

  ipcMain.handle('git:status-count', async (_e, dir: string) => {
    try {
      assertSafePath(dir);
      return await statusCount(dir);
    } catch (err) {
      logger.warn({ dir, err }, 'git:status-count failed');
      return 0;
    }
  });
}
