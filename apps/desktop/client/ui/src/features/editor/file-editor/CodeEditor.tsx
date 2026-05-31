import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../shared/store/appStore';
import type { FileTab } from '../../../shared/store/fileTabsSlice';
import { FindReplaceBar, type FindReplaceAdapter, type FindReplaceMode, type FindMatch } from '../FindReplaceBar';
import { EditorStatusBar } from './EditorStatusBar';

export function CodeEditor({ file }: { file: FileTab }) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const [findMode, setFindMode] = useState<FindReplaceMode | null>(null);

  const lineCount = useMemo(() => file.content.split('\n').length, [file.content]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateFileContent(file.path, e.target.value);
    },
    [file.path, updateFileContent],
  );

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

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

  const ext = file.name.split('.').pop()?.toUpperCase() ?? 'TEXT';

  return (
    <div className="file-editor-code">
      {findMode && (
        <FindReplaceBar mode={findMode} adapter={adapter} onClose={() => setFindMode(null)} />
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
          spellCheck={false}
        />
      </div>
      <EditorStatusBar content={file.content} fileType={ext} />
    </div>
  );
}
