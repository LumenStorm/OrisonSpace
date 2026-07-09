import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../shared/store/appStore';
import type { FileTab } from '../../../shared/store/fileTabsSlice';
import { FindReplaceBar, type FindReplaceAdapter, type FindMatch, type FindReplaceMode } from '../FindReplaceBar';
import { EditorStatusBar } from './EditorStatusBar';

type HistoryEntry = { content: string };
const HISTORY_LIMIT = 200;
// Coalesce rapid keystrokes into a single undo step (like native editors).
const COALESCE_MS = 400;

// Caret position to land on after swapping `from` -> `to`: the end of the
// region that actually changed, so editing naturally continues after the
// restored text (matches native/VSCode undo feel). Exported for testing.
export function caretAfterSwap(from: string, to: string): number {
  if (from === to) return to.length;
  let pre = 0;
  const maxPre = Math.min(from.length, to.length);
  while (pre < maxPre && from[pre] === to[pre]) pre++;
  let suf = 0;
  const maxSuf = Math.min(from.length - pre, to.length - pre);
  while (suf < maxSuf && from[from.length - 1 - suf] === to[to.length - 1 - suf]) suf++;
  // End of the changed span within `to`.
  return to.length - suf;
}

export function CodeEditor({ file }: { file: FileTab }) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);
  const updateFileViewport = useAppStore((s) => s.updateFileViewport);
  const spellCheck = useAppStore((s) => s.spellCheck);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const [findMode, setFindMode] = useState<FindReplaceMode | null>(null);

  // Controlled <textarea> loses the browser's native undo history (React forces
  // `value` every render), so we maintain our own per-file undo/redo stacks.
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const lastPushAt = useRef(0);
  const fileIdRef = useRef(file.id);
  // Track the last content/savedContent we reacted to, so we can tell a user's
  // own save (savedContent changes, content doesn't) apart from an external
  // reload / agent patch (both change to the new on-disk text).
  const savedRef = useRef(file.savedContent);
  const contentRef = useRef(file.content);
  const viewportRafRef = useRef<number | null>(null);

  // Reset history when a different file becomes active in this reused editor.
  useEffect(() => {
    if (file.id !== fileIdRef.current) {
      fileIdRef.current = file.id;
      savedRef.current = file.savedContent;
      contentRef.current = file.content;
      undoStack.current = [];
      redoStack.current = [];
      lastPushAt.current = 0;
      return;
    }
    if (file.savedContent === savedRef.current) return;
    savedRef.current = file.savedContent;
    // External reload / patch swapped the buffer out from under us: the stale
    // undo stack now holds snapshots that no longer match disk, so Ctrl+Z would
    // restore deleted text. Clear it. A user's own save (content unchanged)
    // keeps history intact.
    if (file.content !== contentRef.current) {
      contentRef.current = file.content;
      undoStack.current = [];
      redoStack.current = [];
      lastPushAt.current = 0;
    }
  }, [file.id, file.savedContent, file.content]);

  const lineCount = useMemo(() => file.content.split('\n').length, [file.content]);

  const readViewport = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return null;
    return {
      selectionStart: ta.selectionStart,
      selectionEnd: ta.selectionEnd,
      scrollTop: ta.scrollTop,
    };
  }, []);

  const flushViewport = useCallback(() => {
    if (viewportRafRef.current !== null) {
      cancelAnimationFrame(viewportRafRef.current);
      viewportRafRef.current = null;
    }
    const viewport = readViewport();
    if (viewport) updateFileViewport(file.path, viewport);
  }, [file.path, readViewport, updateFileViewport]);

  const recordViewport = useCallback(() => {
    if (viewportRafRef.current !== null) return;
    viewportRafRef.current = requestAnimationFrame(() => {
      viewportRafRef.current = null;
      const viewport = readViewport();
      if (viewport) updateFileViewport(file.path, viewport);
    });
  }, [file.path, readViewport, updateFileViewport]);

  useEffect(() => () => {
    if (viewportRafRef.current !== null) {
      cancelAnimationFrame(viewportRafRef.current);
      viewportRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    requestAnimationFrame(() => {
      const current = textareaRef.current;
      if (!current) return;
      const start = Math.min(file.selectionStart ?? 0, current.value.length);
      const end = Math.min(file.selectionEnd ?? start, current.value.length);
      current.setSelectionRange(start, end);
      current.scrollTop = file.scrollTop ?? 0;
      if (lineNumRef.current) lineNumRef.current.scrollTop = current.scrollTop;
    });
  }, [file.id, file.selectionStart, file.selectionEnd, file.scrollTop]);

  // Snapshot the current content onto the undo stack (clears redo).
  const pushHistory = useCallback(() => {
    undoStack.current.push({ content: file.content });
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
  }, [file.content]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const ta = e.target;
      const now = Date.now();
      // Push the pre-edit snapshot, coalescing bursts of typing into one step.
      if (now - lastPushAt.current > COALESCE_MS) pushHistory();
      lastPushAt.current = now;
      contentRef.current = ta.value;
      updateFileContent(file.path, ta.value);
      updateFileViewport(file.path, {
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
        scrollTop: ta.scrollTop,
      });
    },
    [file.path, updateFileContent, updateFileViewport, pushHistory],
  );

  const restore = useCallback(
    (fromContent: string, entry: HistoryEntry) => {
      // Keep contentRef in sync so a later save isn't mistaken for a reload.
      contentRef.current = entry.content;
      updateFileContent(file.path, entry.content);
      const caret = caretAfterSwap(fromContent, entry.content);
      // Reapply caret after React commits the new value.
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(caret, caret);
          updateFileViewport(file.path, {
            selectionStart: caret,
            selectionEnd: caret,
            scrollTop: ta.scrollTop,
          });
        }
      });
    },
    [file.path, updateFileContent, updateFileViewport],
  );

  const handleUndo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({ content: file.content });
    lastPushAt.current = 0; // force the next edit to start a fresh undo step
    restore(file.content, prev);
  }, [file.content, restore]);

  const handleRedo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ content: file.content });
    lastPushAt.current = 0;
    restore(file.content, next);
  }, [file.content, restore]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
    recordViewport();
  }, [recordViewport]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); handleRedo(); }
    },
    [handleUndo, handleRedo],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'f') { e.preventDefault(); setFindMode('find'); }
      if (e.key === 'h') { e.preventDefault(); setFindMode('replace'); }
    };
    const el = textareaRef.current?.closest('.file-editor-code');
    el?.addEventListener('keydown', handler as EventListener);
    return () => el?.removeEventListener('keydown', handler as EventListener);
  }, []);

  // Open the find bar on a menu-bar / command-palette find request (nonce-keyed).
  const findRequest = useAppStore((s) => s.findRequest);
  useEffect(() => {
    if (!findRequest) return;
    setFindMode(findRequest.mode);
  }, [findRequest]);

  const adapter: FindReplaceAdapter = useMemo(() => ({
    getText: () => file.content,
    highlight: (match: FindMatch) => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(match.start, match.end);
      const linesBefore = file.content.slice(0, match.start).split('\n').length;
      const lineHeight = ta.scrollHeight / (file.content.split('\n').length || 1);
      ta.scrollTop = Math.max(0, (linesBefore - 3) * lineHeight);
    },
    replaceOne: (match: FindMatch, replacement: string) => {
      const before = file.content.slice(0, match.start);
      const after = file.content.slice(match.end);
      pushHistory();
      updateFileContent(file.path, before + replacement + after);
    },
    replaceAll: (matches: FindMatch[], replacement: string) => {
      let result = file.content;
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        result = result.slice(0, m.start) + replacement + result.slice(m.end);
      }
      pushHistory();
      updateFileContent(file.path, result);
    },
  }), [file.content, file.path, updateFileContent, pushHistory]);

  const ext = file.name.split('.').pop()?.toUpperCase() ?? 'TEXT';

  return (
    <div className="file-editor-code">
      {findMode && (
        <FindReplaceBar initialMode={findMode ?? 'find'} adapter={adapter} onClose={() => setFindMode(null)} />
      )}
      <div className="code-editor-body">
        <div className="code-editor-line-numbers" ref={lineNumRef} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="code-editor-textarea"
          value={file.content}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={recordViewport}
          onMouseUp={recordViewport}
          onSelect={recordViewport}
          onBlur={flushViewport}
          spellCheck={spellCheck}
        />
      </div>
      <EditorStatusBar content={file.content} fileType={ext} />
    </div>
  );
}
