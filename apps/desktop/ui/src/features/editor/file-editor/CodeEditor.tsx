import { useCallback } from 'react';
import { useAppStore } from '../../../shared/store/appStore';
import type { FileTab } from '../../../shared/store/fileTabsSlice';

export function CodeEditor({ file }: { file: FileTab }) {
  const updateFileContent = useAppStore((s) => s.updateFileContent);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateFileContent(file.path, e.target.value);
    },
    [file.path, updateFileContent],
  );

  return (
    <div className="file-editor-code">
      <textarea
        className="code-editor-textarea"
        value={file.content}
        onChange={handleChange}
        spellCheck={false}
      />
    </div>
  );
}
