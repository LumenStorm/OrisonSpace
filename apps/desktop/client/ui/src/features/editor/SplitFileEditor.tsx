import { useAppStore } from '../../shared/store/appStore';
import { isImageFileName, isDocxFileName } from '../../shared/utils/fileType';
import { ImagePreview } from './file-editor/ImagePreview';
import { DocxPreview } from './file-editor/DocxPreview';
import { TextFileEditor } from './TextFileEditor';
import { FileConflictBanner } from './FileConflictBanner';

export function SplitFileEditor({ filePath }: { filePath: string }) {
  const openFiles = useAppStore((s) => s.openFiles);
  const file = openFiles.find((f) => f.path === filePath);
  if (!file) return null;

  if (file.kind === 'image' || isImageFileName(file.name)) {
    return <ImagePreview file={file} />;
  }

  if (file.kind === 'docx' || isDocxFileName(file.name)) {
    return <DocxPreview file={file} />;
  }

  // Same shell as the main pane, so split panes also surface the
  // external-change conflict banner and the source-mode fallback.
  return (
    <div className="file-editor-shell">
      <FileConflictBanner file={file} />
      <TextFileEditor file={file} />
    </div>
  );
}
