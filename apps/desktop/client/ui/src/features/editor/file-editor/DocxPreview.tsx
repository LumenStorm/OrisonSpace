import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../shared/store/appStore';
import { useI18n } from '../../../shared/i18n/useI18n';
import { useToastStore } from '../../../shared/store/toastStore';
import { normalizePath } from '../../../shared/utils/paths';
import type { FileTab } from '../../../shared/store/fileTabsSlice';

/**
 * Read-only renderer for in-project .docx files. mammoth-converted HTML is
 * stored on the tab's `content`. The toolbar exposes a single "Convert to
 * Markdown" action (top-right, mirroring the MarkdownEditor heading toolbar).
 */
export function DocxPreview({ file }: { file: FileTab }) {
  const { currentProject, resolvedLocale, openFile, refreshWordCount } = useAppStore(
    useShallow((s) => ({
      currentProject: s.currentProject,
      resolvedLocale: s.resolvedLocale,
      openFile: s.openFile,
      refreshWordCount: s.refreshWordCount,
    })),
  );
  const showToast = useToastStore((s) => s.showToast);
  const { t } = useI18n(resolvedLocale);
  const [converting, setConverting] = useState(false);

  const handleConvert = useCallback(async () => {
    if (converting || !currentProject?.path) return;
    setConverting(true);
    try {
      const mdPath = await window.orisonDesktop?.docxToMarkdown(file.path, currentProject.path);
      if (!mdPath) {
        showToast(t('fileEditor.docxConvertFailed'), 'error');
        return;
      }
      const content = (await window.orisonDesktop?.readFile(mdPath)) ?? '';
      const name = mdPath.split(/[\\/]/).pop() ?? mdPath;
      openFile(normalizePath(mdPath), name, content, { kind: 'text' });
      void refreshWordCount();
      showToast(t('fileEditor.docxConverted', { name }), 'success');
    } catch {
      showToast(t('fileEditor.docxConvertFailed'), 'error');
    } finally {
      setConverting(false);
    }
  }, [converting, currentProject?.path, file.path, openFile, refreshWordCount, showToast, t]);

  return (
    <div className="file-editor-docx">
      <div className="docx-preview-toolbar" role="toolbar" aria-label={file.name}>
        <span className="docx-preview-name">{file.name}</span>
        <button
          type="button"
          className="docx-preview-convert"
          onClick={handleConvert}
          disabled={converting}
        >
          <span className="material-symbols-outlined" aria-hidden="true">markdown</span>
          {t('fileEditor.convertToMd')}
        </button>
      </div>
      <div className="docx-preview-body">
        {/* mammoth emits body markup only (no script/style); rendered in a
            sandboxed, read-only container for the user's own local file. */}
        <div className="docx-preview-content" dangerouslySetInnerHTML={{ __html: file.content }} />
      </div>
    </div>
  );
}
