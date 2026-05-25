import { ipcMain } from 'electron';
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
  const oids = await git.log({ fs, dir: root, depth });
  return oids.map((entry) => ({
    oid: entry.oid,
    message: entry.commit.message.trim(),
    author: entry.commit.author.name,
    timestamp: entry.commit.author.timestamp,
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
}
