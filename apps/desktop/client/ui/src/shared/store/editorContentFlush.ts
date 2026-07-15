/**
 * Pending editor-content flush registry.
 *
 * CodeEditor / TiptapEditor debounce store writes (~200ms) so keystroke fan-out
 * stays cheap. Save / project switch / dirty checks must still see the latest
 * keystrokes — editors register a flush callback on mount, and save paths call
 * `flushPendingEditorContent()` before reading `openFiles[].content`.
 */

type FlushFn = () => void;

const flushFns = new Set<FlushFn>();

/** Register a mounted editor's pending-content flush. Returns unregister. */
export function registerEditorContentFlush(fn: FlushFn): () => void {
  flushFns.add(fn);
  return () => {
    flushFns.delete(fn);
  };
}

/** Synchronously flush every mounted editor's local buffer into the store. */
export function flushPendingEditorContent(): void {
  for (const fn of flushFns) {
    try {
      fn();
    } catch {
      // One editor must not block the rest (or save).
    }
  }
}
