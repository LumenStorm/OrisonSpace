import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../shared/store/appStore';
import { TiptapEditor } from '../TiptapEditor';
import { DocOutline } from '../DocOutline';
import type { FileTab } from '../../../shared/store/fileTabsSlice';
import { FindReplaceBar, type FindReplaceAdapter, type FindReplaceMode, type FindMatch } from '../FindReplaceBar';

export function MarkdownEditor({ file }: { file: FileTab }) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [findMode, setFindMode] = useState<FindReplaceMode | null>(null);

  const handleChange = useCallback(
    (markdown: string) => {
      updateFileContent(file.path, markdown);
    },
    [file.path, updateFileContent],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'f') { e.preventDefault(); setFindMode('find'); }
      if (e.key === 'h') { e.preventDefault(); setFindMode('replace'); }
    };
    const el = containerRef.current;
    el?.addEventListener('keydown', handler);
    return () => el?.removeEventListener('keydown', handler);
  }, []);

  const adapter: FindReplaceAdapter = useMemo(() => ({
    getText: () => file.content,
    highlight: (match: FindMatch) => {
      // For Tiptap, we highlight by selecting the range in the ProseMirror doc.
      // Since we don't have direct editor access here, we use window.find as a fallback.
      const text = file.content.slice(match.start, match.end);
      if (text && window.getSelection && containerRef.current) {
        // Use native find for highlighting
        const sel = window.getSelection();
        sel?.removeAllRanges();
        // Walk text nodes to find the match
        const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT);
        let offset = 0;
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const len = (node.textContent ?? '').length;
          if (offset + len > match.start) {
            const range = document.createRange();
            const localStart = match.start - offset;
            const localEnd = Math.min(match.end - offset, len);
            range.setStart(node, localStart);
            if (match.end <= offset + len) {
              range.setEnd(node, localEnd);
            } else {
              range.setEnd(node, len);
            }
            sel?.addRange(range);
            (node as HTMLElement).parentElement?.scrollIntoView?.({ block: 'center' });
            break;
          }
          offset += len;
        }
      }
    },
    replaceOne: (match: FindMatch, replacement: string) => {
      const before = file.content.slice(0, match.start);
      const after = file.content.slice(match.end);
      updateFileContent(file.path, before + replacement + after);
    },
    replaceAll: (matches: FindMatch[], replacement: string) => {
      let result = file.content;
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        result = result.slice(0, m.start) + replacement + result.slice(m.end);
      }
      updateFileContent(file.path, result);
    },
  }), [file.content, file.path, updateFileContent]);

  const handleJumpToLine = useCallback((line: number) => {
    const el = containerRef.current;
    if (!el) return;
    // Find the corresponding heading element in Tiptap rendered DOM
    const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
    // Count markdown headings up to 'line' to find the correct DOM heading
    const lines = file.content.split('\n');
    let headingIndex = 0;
    for (let i = 0; i < line; i++) {
      if (/^#{1,6}\s+/.test(lines[i])) headingIndex++;
    }
    const target = headings[headingIndex];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [file.content]);

  return (
    <div className="file-editor-md" ref={containerRef}>
      {findMode && (
        <FindReplaceBar mode={findMode} adapter={adapter} onClose={() => setFindMode(null)} />
      )}
      <DocOutline content={file.content} onJump={handleJumpToLine} />
      <TiptapEditor
        key={file.path}
        content={file.content}
        format="markdown"
        placeholder="Start writing..."
        onChange={handleChange}
        flush
      />
    </div>
  );
}
