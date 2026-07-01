import { useCallback, useRef, useState, useEffect } from 'react';
import { useAppStore } from '../../../shared/store/appStore';
import { useShallow } from 'zustand/react/shallow';
import { TiptapEditor, type SelectionInfo } from '../TiptapEditor';
import { DocOutline } from '../DocOutline';
import { EditorStatusBar } from './EditorStatusBar';
import { useI18n } from '../../../shared/i18n/useI18n';
import type { FileTab } from '../../../shared/store/fileTabsSlice';
import type { SelectionAttachment } from '../../../shared/types/attachment';
import { randomUUID } from '../../../shared/util/id';

export function MarkdownEditor({ file }: { file: FileTab }) {
  const { updateFileContent, addAttachment, setAgentPanelOpen, sendAgentMessage, resolvedLocale } = useAppStore(
    useShallow((s) => ({
      updateFileContent: s.updateFileContent,
      addAttachment: s.addAttachment,
      setAgentPanelOpen: s.setAgentPanelOpen,
      sendAgentMessage: s.sendAgentMessage,
      resolvedLocale: s.resolvedLocale,
    })),
  );
  const { t } = useI18n(resolvedLocale);
  const containerRef = useRef<HTMLDivElement>(null);
  const [revision, setRevision] = useState(0);
  // The file currently bound to the live editor instance.
  const fileIdRef = useRef(file.id);
  // Last `savedContent` we reacted to, used to detect save/reload transitions.
  const savedRef = useRef(file.savedContent);
  // Latest markdown the editor holds: seeded with the mounted content, then
  // kept in sync via onChange. Lets us tell a user's own save apart from an
  // external reload/patch when `savedContent` changes.
  const contentRef = useRef(file.content);

  useEffect(() => {
    // MarkdownEditor is reused across tab switches (the parent sets no React
    // key), so reset trackers whenever a different file becomes active. The
    // TiptapEditor key carries file.id, so it remounts on its own here.
    if (file.id !== fileIdRef.current) {
      fileIdRef.current = file.id;
      savedRef.current = file.savedContent;
      contentRef.current = file.content;
      return;
    }
    if (file.savedContent === savedRef.current) return;
    savedRef.current = file.savedContent;
    // (a) User's own save: the store sets savedContent = current content, which
    //     already matches what the editor holds -> skip remount (keep cursor
    //     position and undo history).
    // (b) External reload / agent patch: savedContent becomes content the editor
    //     does not have -> bump revision to remount and reflect the change.
    if (file.savedContent !== contentRef.current) {
      contentRef.current = file.content;
      setRevision((r) => r + 1);
    }
  }, [file.id, file.savedContent, file.content]);

  const handleChange = useCallback(
    (markdown: string) => {
      contentRef.current = markdown;
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

  const handleSelectionAction = useCallback((action: 'review' | 'attach' | 'continue' | 'polish', sel: SelectionInfo) => {
    const content = contentRef.current;
    const prefix = content.slice(Math.max(0, sel.from - 50), sel.from);
    const suffix = content.slice(sel.to, sel.to + 50);
    const att: SelectionAttachment = {
      type: 'selection',
      id: randomUUID(),
      label: sel.text.slice(0, 20) + (sel.text.length > 20 ? '…' : ''),
      text: sel.text,
      sourceType: 'file',
      filePath: file.path,
      anchor: { quote: sel.text, prefix, suffix, rangeHint: { from: sel.from, to: sel.to } },
    };
    addAttachment(att);
    setAgentPanelOpen(true);
    if (action === 'review') {
      void sendAgentMessage(t('editor.aiReviewPrompt'));
    } else if (action === 'continue') {
      void sendAgentMessage(t('editor.aiContinuePrompt'));
    } else if (action === 'polish') {
      void sendAgentMessage(t('editor.aiPolishPrompt'));
    }
  }, [file.path, addAttachment, setAgentPanelOpen, sendAgentMessage, t]);

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
        onSelectionAction={handleSelectionAction}
      />
      <EditorStatusBar content={file.content} fileType="Markdown" />
    </div>
  );
}
