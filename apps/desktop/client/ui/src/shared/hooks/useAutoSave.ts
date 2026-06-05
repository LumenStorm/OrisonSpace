import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

/** Idle window before an edit burst is flushed to disk. */
const AUTOSAVE_DEBOUNCE_MS = 1500;

/** Dispatched by the status bar "retry" affordance to force an immediate save. */
export const AUTOSAVE_RETRY_EVENT = 'orison:autosave-retry';

/** Serialize the editor chapters so we can skip disk writes when nothing changed. */
function serializeChapters(chapters: { id: string; title: string; content: string }[]): string {
  return JSON.stringify(chapters);
}

/**
 * Background autosave for the workspace.
 *
 * Triggers:
 *  - debounced (1500ms) whenever a dirty file tab or a chapter edit appears
 *  - immediately on window blur (don't lose work when switching apps)
 *  - immediately on an explicit retry request from the status bar
 *
 * The hook subscribes to the store directly (cheap reference checks) rather than
 * re-rendering on every keystroke, and tears down its timer + listeners on unmount.
 */
export function useAutoSave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let saving = false;
    // Last chapters snapshot we persisted — gates the chapter write (no dirty concept).
    let savedChaptersSig = serializeChapters(useAppStore.getState().chapters);

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const runSave = async () => {
      if (saving) return;
      const state = useAppStore.getState();
      if (!state.autoSaveEnabled || !state.currentProject?.path) return;

      // Snapshot the paths that are dirty now; we verify these specific paths
      // got their savedContent updated, so concurrent edits during the await
      // don't get misread as a failure.
      const dirtyPaths = state.openFiles
        .filter((f) => f.kind === 'text' && f.content !== f.savedContent)
        .map((f) => f.path);
      const chaptersSig = serializeChapters(state.chapters);
      const chaptersChanged = chaptersSig !== savedChaptersSig;

      if (dirtyPaths.length === 0 && !chaptersChanged) return;

      saving = true;
      state.setSaveStatus('saving');
      try {
        if (dirtyPaths.length > 0) {
          await state.saveAllOpenFiles();
        }
        if (chaptersChanged) {
          await state.saveChaptersToProject();
        }

        // Verify the files we set out to save actually landed on disk.
        const after = useAppStore.getState().openFiles;
        const stillDirty = dirtyPaths.some((path) => {
          const file = after.find((f) => f.path === path);
          return file != null && file.content !== file.savedContent;
        });

        if (stillDirty) {
          state.setSaveStatus('error');
        } else {
          savedChaptersSig = chaptersSig;
          state.setLastSavedAt(Date.now());
          state.setSaveStatus('saved');
          // Content landed on disk; keep the overview word count in sync.
          void state.refreshWordCount();
        }
      } catch {
        state.setSaveStatus('error');
      } finally {
        saving = false;
      }
    };

    const schedule = () => {
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void runSave();
      }, AUTOSAVE_DEBOUNCE_MS);
    };

    // Cheap trigger source: only react when the openFiles or chapters arrays
    // change identity (zustand replaces them immutably on edit).
    let prevFiles = useAppStore.getState().openFiles;
    let prevChapters = useAppStore.getState().chapters;
    const unsubscribe = useAppStore.subscribe((s) => {
      if (s.openFiles !== prevFiles || s.chapters !== prevChapters) {
        prevFiles = s.openFiles;
        prevChapters = s.chapters;
        schedule();
      }
    });

    const flushNow = () => {
      clearTimer();
      void runSave();
    };

    window.addEventListener('blur', flushNow);
    window.addEventListener(AUTOSAVE_RETRY_EVENT, flushNow);

    return () => {
      clearTimer();
      unsubscribe();
      window.removeEventListener('blur', flushNow);
      window.removeEventListener(AUTOSAVE_RETRY_EVENT, flushNow);
    };
  }, []);
}
