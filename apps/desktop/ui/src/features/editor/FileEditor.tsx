import { useCallback, useEffect } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { TiptapEditor } from './TiptapEditor';
import type { FileTab } from '../../shared/store/fileTabsSlice';

function MarkdownEditor({ file }: { file: FileTab }) {
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

function CodeEditor({ file }: { file: FileTab }) {
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

function ReadOnlyPreview({ file }: { file: FileTab }) {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

  return (
    <div className="file-editor-readonly">
      <span className="material-symbols-outlined" aria-hidden="true">visibility</span>
      <p>{t('fileEditor.readOnly')}</p>
      <pre className="file-editor-readonly-content">{file.content}</pre>
    </div>
  );
}

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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'md') {
    return <MarkdownEditor file={file} />;
  }

  if (ext === 'yaml' || ext === 'yml') {
    return <CodeEditor file={file} />;
  }

  return <ReadOnlyPreview file={file} />;
}
