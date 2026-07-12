import { useMemo, useRef } from 'react';
import { getFileExtension } from '../../shared/utils/fileType';
import { isMarkdownRoundTripLossy } from '../../shared/utils/markdown';
import type { FileTab } from '../../shared/store/fileTabsSlice';
import { MarkdownEditor } from './file-editor/MarkdownEditor';
import { CodeEditor } from './file-editor/CodeEditor';
import { ReadOnlyPreview } from './file-editor/ReadOnlyPreview';
import { SourceModeBanner } from './SourceModeBanner';

/**
 * Text-file routing shared by the main pane and split panes: YAML gets the
 * source editor, markdown-like files get the rich editor — unless the on-disk
 * content wouldn't survive the rich editor's schema (tables, images, raw HTML,
 * front-matter), in which case the tab falls back to the source editor with a
 * notice instead of silently corrupting the file on the next autosave.
 */
export function TextFileEditor({ file }: { file: FileTab }) {
  const ext = getFileExtension(file.name);
  const isManagedProjectDocument = file.name.toLowerCase() === 'project.yaml';
  const isYaml = ext === 'yaml' || ext === 'yml';
  const isMarkdownLike = ext === 'md' || ext === 'txt' || ext === 'text' || ext === '';

  // Once flagged, a tab stays in source mode for its lifetime — no flapping
  // back to rich text mid-session when the offending construct is edited away.
  // Reopening the tab (new id) re-evaluates.
  const lossyTabsRef = useRef<Set<string>>(new Set());
  // Keyed on savedContent (the on-disk truth), not content: recomputes only on
  // save/reload, never per keystroke. Also catches external reloads / agent
  // patches that introduce rich constructs while the tab is open.
  const lossy = useMemo(() => {
    if (!isMarkdownLike) return false;
    if (lossyTabsRef.current.has(file.id)) return true;
    if (isMarkdownRoundTripLossy(file.savedContent)) {
      lossyTabsRef.current.add(file.id);
      return true;
    }
    return false;
  }, [isMarkdownLike, file.id, file.savedContent]);

  if (isManagedProjectDocument) return <ReadOnlyPreview file={file} />;
  if (isYaml) return <CodeEditor file={file} />;
  if (!isMarkdownLike) return <ReadOnlyPreview file={file} />;
  if (lossy) {
    return (
      <>
        <SourceModeBanner />
        <CodeEditor file={file} />
      </>
    );
  }
  return <MarkdownEditor file={file} />;
}
