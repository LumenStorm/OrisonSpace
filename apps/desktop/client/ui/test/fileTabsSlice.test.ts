import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';
import { createFileTabsSlice, type FileTabsSlice } from '../src/shared/store/fileTabsSlice';

declare global {
  interface Window {
    orisonDesktop: any;
  }
}

const useTestStore = create<FileTabsSlice>()((...a) => createFileTabsSlice(...a));

function reset() {
  useTestStore.setState({ openFiles: [], activeFilePath: null, recentlyClosed: [] });
}

describe('fileTabsSlice', () => {
  beforeEach(() => {
    reset();
    (globalThis.window as any) = globalThis.window ?? {};
    (window as any).orisonDesktop = {
      writeFile: vi.fn(async () => true),
      readFile: vi.fn(async (path: string) => `loaded:${path}`),
    };
  });

  it('opens a file as new tab', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    const s = useTestStore.getState();
    expect(s.openFiles).toHaveLength(1);
    expect(s.openFiles[0].content).toBe('hello');
    expect(s.openFiles[0].savedContent).toBe('hello');
    expect(s.activeFilePath).toBe('/p/a.md');
  });

  it('activates existing tab when opened again', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().openFile('/p/b.md', 'b.md', 'world');
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'IGNORED');
    const s = useTestStore.getState();
    expect(s.openFiles).toHaveLength(2);
    expect(s.activeFilePath).toBe('/p/a.md');
    expect(s.openFiles[0].content).toBe('hello'); // not overwritten
  });

  it('saveFile writes to disk and clears dirty', async () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().updateFileContent('/p/a.md', 'hello edited');
    const ok = await useTestStore.getState().saveFile('/p/a.md');
    expect(ok).toBe(true);
    expect(window.orisonDesktop.writeFile).toHaveBeenCalledWith('/p/a.md', 'hello edited');
    const s = useTestStore.getState();
    expect(s.openFiles[0].savedContent).toBe('hello edited');
  });

  it('saveFile keeps dirty on failure', async () => {
    (window as any).orisonDesktop.writeFile = vi.fn(async () => false);
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().updateFileContent('/p/a.md', 'hello edited');
    const ok = await useTestStore.getState().saveFile('/p/a.md');
    expect(ok).toBe(false);
    expect(useTestStore.getState().openFiles[0].savedContent).toBe('hello');
  });

  it('saveAllOpenFiles only saves dirty tabs', async () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().openFile('/p/b.md', 'b.md', 'world');
    useTestStore.getState().updateFileContent('/p/a.md', 'edited');
    await useTestStore.getState().saveAllOpenFiles();
    expect(window.orisonDesktop.writeFile).toHaveBeenCalledTimes(1);
    expect(window.orisonDesktop.writeFile).toHaveBeenCalledWith('/p/a.md', 'edited');
  });

  it('closeFile records into recentlyClosed', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().closeFile('/p/a.md');
    const s = useTestStore.getState();
    expect(s.openFiles).toHaveLength(0);
    expect(s.recentlyClosed).toHaveLength(1);
    expect(s.recentlyClosed[0].path).toBe('/p/a.md');
  });

  it('reopenLastClosedFile re-reads content from disk', async () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().closeFile('/p/a.md');
    await useTestStore.getState().reopenLastClosedFile();
    const s = useTestStore.getState();
    expect(s.openFiles).toHaveLength(1);
    expect(s.openFiles[0].content).toBe('loaded:/p/a.md');
    expect(s.recentlyClosed).toHaveLength(0);
    expect(window.orisonDesktop.readFile).toHaveBeenCalledWith('/p/a.md');
  });

  it('image tabs are excluded from recentlyClosed', () => {
    useTestStore.getState().openFile('/p/img.png', 'img.png', '', { kind: 'image', dataUrl: 'data:image/png;base64,xxx' });
    useTestStore.getState().closeFile('/p/img.png');
    expect(useTestStore.getState().recentlyClosed).toHaveLength(0);
  });

  it('closeOtherFiles keeps only the anchor', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'a');
    useTestStore.getState().openFile('/p/b.md', 'b.md', 'b');
    useTestStore.getState().openFile('/p/c.md', 'c.md', 'c');
    useTestStore.getState().closeOtherFiles('/p/b.md');
    const s = useTestStore.getState();
    expect(s.openFiles).toHaveLength(1);
    expect(s.openFiles[0].path).toBe('/p/b.md');
    expect(s.activeFilePath).toBe('/p/b.md');
  });

  it('closeFilesToRight closes only tabs after anchor', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'a');
    useTestStore.getState().openFile('/p/b.md', 'b.md', 'b');
    useTestStore.getState().openFile('/p/c.md', 'c.md', 'c');
    useTestStore.getState().closeFilesToRight('/p/a.md');
    const s = useTestStore.getState();
    expect(s.openFiles.map((f) => f.path)).toEqual(['/p/a.md']);
  });

  it('closeAllFiles clears all', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'a');
    useTestStore.getState().openFile('/p/b.md', 'b.md', 'b');
    useTestStore.getState().closeAllFiles();
    expect(useTestStore.getState().openFiles).toHaveLength(0);
    expect(useTestStore.getState().recentlyClosed).toHaveLength(2);
  });

  it('renameOpenFile rebases a single renamed file and its display name', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'a');
    useTestStore.getState().renameOpenFile('/p/a.md', '/p/renamed.md', 'renamed.md');
    const s = useTestStore.getState();
    expect(s.openFiles[0].path).toBe('/p/renamed.md');
    expect(s.openFiles[0].name).toBe('renamed.md');
    expect(s.activeFilePath).toBe('/p/renamed.md');
  });

  it('renameOpenFile rebases files nested under a renamed directory', () => {
    useTestStore.getState().openFile('/p/chapters/c1.md', 'c1.md', '1');
    useTestStore.getState().openFile('/p/chapters/c2.md', 'c2.md', '2');
    useTestStore.getState().openFile('/p/other.md', 'other.md', 'o');
    // Rename the `chapters` directory.
    useTestStore.getState().renameOpenFile('/p/chapters', '/p/parts', 'parts');
    const paths = useTestStore.getState().openFiles.map((f) => f.path);
    expect(paths).toEqual(['/p/parts/c1.md', '/p/parts/c2.md', '/p/other.md']);
    // Nested files keep their own display name; only the prefix changed.
    expect(useTestStore.getState().openFiles[0].name).toBe('c1.md');
  });

  it('closeFilesUnder force-closes a deleted file and its nested tabs', () => {
    useTestStore.getState().openFile('/p/chapters/c1.md', 'c1.md', '1');
    useTestStore.getState().openFile('/p/chapters/c2.md', 'c2.md', '2');
    useTestStore.getState().openFile('/p/keep.md', 'keep.md', 'k');
    // Even with a dirty buffer, a deleted dir's tabs must close without prompting.
    useTestStore.getState().updateFileContent('/p/chapters/c1.md', 'edited');
    useTestStore.getState().closeFilesUnder('/p/chapters');
    expect(useTestStore.getState().openFiles.map((f) => f.path)).toEqual(['/p/keep.md']);
  });

  it('reloadFile clears an external-change flag and resyncs content', async () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().markExternalChange('/p/a.md', 'changed');
    expect(useTestStore.getState().openFiles[0].externalState).toBe('changed');
    await useTestStore.getState().reloadFile('/p/a.md');
    const tab = useTestStore.getState().openFiles[0];
    expect(tab.externalState).toBeUndefined();
    expect(tab.content).toBe('loaded:/p/a.md');
    expect(tab.savedContent).toBe('loaded:/p/a.md');
  });

  it('keepLocalVersion dismisses the banner but preserves unsaved edits', () => {
    useTestStore.getState().openFile('/p/a.md', 'a.md', 'hello');
    useTestStore.getState().updateFileContent('/p/a.md', 'my edit');
    useTestStore.getState().markExternalChange('/p/a.md', 'changed');
    useTestStore.getState().keepLocalVersion('/p/a.md');
    const tab = useTestStore.getState().openFiles[0];
    expect(tab.externalState).toBeUndefined();
    expect(tab.content).toBe('my edit'); // unsaved edit kept
    expect(tab.savedContent).toBe('hello');
  });
});
