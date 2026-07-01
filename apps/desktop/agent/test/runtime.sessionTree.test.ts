import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('runtime session tree', () => {
  let projectPath = '';
  let closeAllDbs: () => void;

  beforeEach(async () => {
    projectPath = mkdtempSync(path.join(os.tmpdir(), 'orison-session-tree-'));
    const persistence = await import('../src/agent/persistence');
    closeAllDbs = persistence.closeAllDbs;
  });

  afterEach(() => {
    closeAllDbs();
    rmSync(projectPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    vi.resetModules();
  });

  it('creates primary and child sessions, lists children, and persists fork metadata', async () => {
    const sessionTree = await import('../src/runtime/sessionTree');
    const sessionStore = await import('../src/agent/session');

    const primary = sessionTree.createPrimarySession({
      agentName: 'writer',
      projectPath,
    });

    expect(primary.sessionRole).toBe('primary');
    expect(primary.parentId).toBeUndefined();
    expect(primary.children).toEqual([]);

    const child = sessionTree.createChildSession({
      parentId: primary.id,
    });

    expect(child.parentId).toBe(primary.id);
    expect(child.sessionRole).toBe('child');
    expect(sessionTree.listChildren(primary.id)).toEqual([child.id]);

    const branchPoint = {
      id: randomUUID(),
      role: 'user' as const,
      content: 'Branch from here.',
      createdAt: Date.now(),
    };
    sessionStore.addMessage(primary.id, branchPoint);

    const fork = sessionTree.forkSession({
      sourceSessionId: primary.id,
      branchFromMessageId: branchPoint.id,
    });

    expect(fork.parentId).toBe(primary.id);
    expect(fork.sessionRole).toBe('fork');
    expect(fork.branchFromMessageId).toBe(branchPoint.id);
    expect(fork.messages).toHaveLength(1);
    expect(fork.messages[0]?.content).toBe('Branch from here.');
    expect(sessionTree.listChildren(primary.id)).toEqual([child.id, fork.id]);

    vi.resetModules();

    const reloadedSessions = await import('../src/agent/session');
    const loadedPrimary = reloadedSessions.loadSession(primary.id, projectPath);
    const loadedChild = reloadedSessions.loadSession(child.id, projectPath);
    const loadedFork = reloadedSessions.loadSession(fork.id, projectPath);

    expect(loadedPrimary?.children).toEqual([child.id, fork.id]);
    expect(loadedChild?.parentId).toBe(primary.id);
    expect(loadedChild?.sessionRole).toBe('child');
    expect(loadedFork?.branchFromMessageId).toBe(branchPoint.id);
    expect(loadedFork?.sessionRole).toBe('fork');
    expect(loadedFork?.messages).toHaveLength(1);
    expect(loadedFork?.messages[0]?.content).toBe('Branch from here.');
  });
});
