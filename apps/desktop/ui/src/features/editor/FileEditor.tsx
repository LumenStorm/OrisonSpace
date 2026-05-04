import { useEffect } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { isImageFileName } from '../../shared/utils/fileType';
import { MarkdownEditor } from './file-editor/MarkdownEditor';
import { CodeEditor } from './file-editor/CodeEditor';
import { ImagePreview } from './file-editor/ImagePreview';
import { ReadOnlyPreview } from './file-editor/ReadOnlyPreview';

export function FileEditor() {
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const openFiles = useAppStore((s) => s.openFiles);
  const saveFile = useAppStore((s) => s.saveFile);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const path = useAppStore.getState().activeFilePath;
        if (path) saveFile(path);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveFile]);

  const file = openFiles.find((f) => f.path === activeFilePath);
  if (!file) return null;

  if (file.kind === 'image' || isImageFileName(file.name)) {
    return <ImagePreview file={file} />;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'md') {
    return <MarkdownEditor file={file} />;
  }

  if (ext === 'yaml' || ext === 'yml') {
    return <CodeEditor file={file} />;
  }

  return <ReadOnlyPreview file={file} />;
}
