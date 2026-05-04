import { useCallback } from 'react';
import { useAppStore } from '../../../shared/store/appStore';
import { TiptapEditor } from '../TiptapEditor';
import type { FileTab } from '../../../shared/store/fileTabsSlice';

export function MarkdownEditor({ file }: { file: FileTab }) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);

  const handleChange = useCallback(
    (html: string) => {
      updateFileContent(file.path, html);
    },
    [file.path, updateFileContent],
  );

  return (
    <div className="file-editor-md">
      <TiptapEditor
        key={file.path}
        content={file.content}
        placeholder="Start writing..."
        onChange={handleChange}
      />
    </div>
  );
}
