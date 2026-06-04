import { useCallback, useRef, useState, useEffect } from 'react';
import { useAppStore } from '../../../shared/store/appStore';
import { TiptapEditor } from '../TiptapEditor';
import { DocOutline } from '../DocOutline';
import { EditorStatusBar } from './EditorStatusBar';
import type { FileTab } from '../../../shared/store/fileTabsSlice';

export function MarkdownEditor({ file }: { file: FileTab }) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);
  const savedRef = useRef(file.savedContent);

  useEffect(() => {
    if (file.savedContent !== savedRef.current) {
      savedRef.current = file.savedContent;
      setRevision((r) => r + 1);
    }
  }, [file.savedContent]);

  const handleChange = useCallback(
    (markdown: string) => {
      updateFileContent(file.path, markdown);
    },
    [file.path, updateFileContent],
  );

  const handleJumpToLine = useCallback((line: number) => {
    const el = containerRef.current;
    if (!el) return;
    const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
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
      <DocOutline content={file.content} onJump={handleJumpToLine} />
      <TiptapEditor
        key={`${file.id}:${revision}`}
        content={file.content}
        format="markdown"
        placeholder="Start writing..."
        onChange={handleChange}
        flush
        bubbleMenu
      />
      <EditorStatusBar content={file.content} fileType="Markdown" />
    </div>
  );
}
