import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../src/shared/store/appStore';

// Phase 0 — slice self-reset registry. Switching the active project must wipe
// EVERY project-scoped slice, not just the agent conversation. Previously the
// open file tabs, split view, chapters and creative fields bled across projects
// because projectSubscription only reset a hand-written subset.

describe('full project-scoped state reset on project switch', () => {
  beforeEach(() => {
    (window as any).orisonDesktop = {
      abortAgentRun: vi.fn(),
      loadProjectDocument: vi.fn().mockResolvedValue(null),
      writeFile: vi.fn().mockResolvedValue(true),
    };
    useAppStore.setState({
      currentProject: null,
      addRecentProject: vi.fn(),
      loadBgTasks: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears open file tabs, split view, chapters, creative fields and image gallery', () => {
    // Open project A and accumulate state across several slices.
    useAppStore.setState({
      currentProject: { projectId: 'A', name: 'A', path: 'I:/proj-a', type: 'novel' },
    } as any);
    useAppStore.setState({
      openFiles: [{ id: 't1', path: 'I:/proj-a/chapters/c1.md', name: 'c1.md', content: 'hi', savedContent: 'hi', kind: 'text' }],
      activeFilePath: 'I:/proj-a/chapters/c1.md',
      mainView: 'files',
      splitDirection: 'vertical',
      splitFilePath: 'I:/proj-a/chapters/c1.md',
      novelChapters: [{ id: 'ch1', title: 'Ch1', sortOrder: 0, status: 'draft', sections: [] }],
      creativeFields: { world_setting: { foo: 'bar' } },
      imageGenResultsMeta: [{ id: 'i1', prompt: 'p', tempRelativePath: 't', mimeType: 'image/png', assetAdded: false, source: 'generated' }],
      pendingDiffs: [{ kind: 'chapter', id: 'd1', toolId: 'chapter_write', fileName: 'c1.md', content: 'x' }],
    } as any);

    // Switch to project B.
    useAppStore.setState({
      currentProject: { projectId: 'B', name: 'B', path: 'I:/proj-b', type: 'novel' },
    } as any);

    const s = useAppStore.getState();
    expect(s.openFiles).toEqual([]);
    expect(s.activeFilePath).toBeNull();
    expect(s.mainView).toBe('page');
    expect(s.splitDirection).toBe('none');
    expect(s.splitFilePath).toBeNull();
    expect(s.novelChapters).toEqual([]);
    expect(s.creativeFields).toEqual({});
    expect(s.imageGenResultsMeta).toEqual([]);
    expect(s.pendingDiffs).toEqual([]);
  });

  it('flushes dirty open files before tearing down the previous project', () => {
    useAppStore.setState({
      currentProject: { projectId: 'A', name: 'A', path: 'I:/proj-a', type: 'novel' },
    } as any);
    useAppStore.setState({
      openFiles: [{ id: 't1', path: 'I:/proj-a/c1.md', name: 'c1.md', content: 'edited', savedContent: 'old', kind: 'text' }],
      activeFilePath: 'I:/proj-a/c1.md',
    } as any);

    useAppStore.setState({
      currentProject: { projectId: 'B', name: 'B', path: 'I:/proj-b', type: 'novel' },
    } as any);

    // The dirty buffer is written to disk by its absolute path before reset.
    expect((window as any).orisonDesktop.writeFile).toHaveBeenCalledWith('I:/proj-a/c1.md', 'edited');
    expect(useAppStore.getState().openFiles).toEqual([]);
  });
});
