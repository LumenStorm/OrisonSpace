import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../shared/store/appStore';

const SCALE = 0.12;

// The scrollable container of the MAIN editor (not the split pane). Markdown
// uses `.tiptap-content` (overflow:auto); code/yaml uses the textarea itself.
// Scoping to `.file-editor-shell` keeps the minimap bound to the active file
// rather than the first editor in the DOM when a split view is open.
const SCROLL_SELECTOR = '.file-editor-shell .tiptap-content, .file-editor-shell .code-editor-textarea';

function getScrollEl(): HTMLElement | null {
  return document.querySelector(SCROLL_SELECTOR) as HTMLElement | null;
}

export function Minimap() {
  const activeFileContent = useAppStore((s) => {
    const file = s.openFiles.find((f) => f.path === s.activeFilePath);
    return file?.content ?? '';
  });
  const activeFilePath = useAppStore((s) => s.activeFilePath);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(50);
  const [dragging, setDragging] = useState(false);

  const syncViewport = useCallback(() => {
    const editor = getScrollEl();
    if (!editor || !contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = editor;
    if (scrollHeight <= 0) return;
    const scaledTotal = contentRef.current.offsetHeight;
    const ratio = scaledTotal / scrollHeight;
    setViewportTop(scrollTop * ratio);
    setViewportHeight(clientHeight * ratio);
  }, []);

  // Bind the scroll listener to the active editor. The editor DOM may mount a
  // frame after this effect (Tiptap remounts on file/revision change), so retry
  // briefly until the container exists.
  useEffect(() => {
    let editor: HTMLElement | null = null;
    let raf = 0;
    let tries = 0;
    const bind = () => {
      editor = getScrollEl();
      if (editor) {
        editor.addEventListener('scroll', syncViewport);
        syncViewport();
        return;
      }
      if (tries++ < 30) raf = requestAnimationFrame(bind);
    };
    bind();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      editor?.removeEventListener('scroll', syncViewport);
    };
  }, [syncViewport, activeFilePath, activeFileContent]);

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
    const editor = getScrollEl();
    if (!container || !content || !editor || content.offsetHeight <= 0) return;

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
