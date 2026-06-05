import { useAppStore } from '../../shared/store/appStore';
import { getFileExtension, isImageFileName, isDocxFileName } from '../../shared/utils/fileType';
import { MarkdownEditor } from './file-editor/MarkdownEditor';
import { CodeEditor } from './file-editor/CodeEditor';
import { ImagePreview } from './file-editor/ImagePreview';
import { DocxPreview } from './file-editor/DocxPreview';
import { ReadOnlyPreview } from './file-editor/ReadOnlyPreview';

export function FileEditor() {
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const openFiles = useAppStore((s) => s.openFiles);

  const file = openFiles.find((f) => f.path === activeFilePath);
  if (!file) return null;

  if (file.kind === 'image' || isImageFileName(file.name)) {
    return <ImagePreview file={file} />;
  }

  if (file.kind === 'docx' || isDocxFileName(file.name)) {
    return <DocxPreview file={file} />;
  }

  const ext = getFileExtension(file.name);

  if (ext === 'yaml' || ext === 'yml') {
    return <CodeEditor file={file} />;
  }

  if (ext === 'md' || ext === 'txt' || ext === 'text' || ext === '') {
    return <MarkdownEditor file={file} />;
  }

  return <ReadOnlyPreview file={file} />;
}
