import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';

const SCALE = 0.12;

export function Minimap() {
  const activeFileContent = useAppStore((s) => {
    const file = s.openFiles.find((f) => f.path === s.activeFilePath);
    return file?.content ?? '';
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(50);
  const [dragging, setDragging] = useState(false);

  const syncViewport = useCallback(() => {
    const editor = document.querySelector('.tiptap-editor-scroll, .code-editor-scroll');
    if (!editor || !contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = editor as HTMLElement;
    const scaledTotal = contentRef.current.offsetHeight;
    const ratio = scaledTotal / scrollHeight;
    setViewportTop(scrollTop * ratio);
    setViewportHeight(clientHeight * ratio);
  }, []);

  useEffect(() => {
    const editor = document.querySelector('.tiptap-editor-scroll, .code-editor-scroll');
    if (!editor) return;
    editor.addEventListener('scroll', syncViewport);
    syncViewport();
    return () => editor.removeEventListener('scroll', syncViewport);
  }, [syncViewport, activeFileContent]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    scrollToY(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    scrollToY(e);
  };

  const handleMouseUp = () => setDragging(false);

  const scrollToY = (e: React.MouseEvent) => {
    const container = containerRef.current;
    const content = contentRef.current;
    const editor = document.querySelector('.tiptap-editor-scroll, .code-editor-scroll') as HTMLElement | null;
    if (!container || !content || !editor) return;

    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / content.offsetHeight;
    editor.scrollTop = ratio * editor.scrollHeight - editor.clientHeight / 2;
  };

  if (!activeFileContent) return null;

  const lines = activeFileContent.split('\n');

  return (
    <div
      className="minimap"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="minimap-content" ref={contentRef} style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
        {lines.map((line, i) => (
          <div key={i} className="minimap-line">
            {line || ' '}
          </div>
        ))}
      </div>
      <div
        className="minimap-viewport"
        style={{ top: `${viewportTop}px`, height: `${Math.max(viewportHeight, 10)}px` }}
      />
    </div>
  );
}
