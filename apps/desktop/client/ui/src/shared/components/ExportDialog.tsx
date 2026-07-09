import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useToastStore } from '../../shared/store/toastStore';
import { normalizePath } from '../../shared/utils/paths';
import type { NovelChapterMeta } from '../../shared/store/novelChapterSlice';
import {
  buildDocxPackage,
  buildMarkdownManuscript,
  buildPlainTextManuscript,
  exportFilename,
  type ChapterManuscript,
} from '../export/exportBuilder';

type ExportFormat = 'md' | 'txt' | 'docx' | 'pdf';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { novelChapters, resolvedLocale, project } = useAppStore(useShallow((s) => ({
    novelChapters: s.novelChapters as NovelChapterMeta[],
    resolvedLocale: s.resolvedLocale,
    project: s.currentProject,
  })));
  const { t } = useI18n(resolvedLocale);
  const showToast = useToastStore((s) => s.showToast);
  const [format, setFormat] = useState<ExportFormat>('md');
  const [busy, setBusy] = useState(false);

  /** Read every chapter's manuscript file (the source of truth) and keep chapter boundaries. */
  const collectChapters = async (): Promise<ChapterManuscript[]> => {
    const projectPath = project?.path;
    if (!projectPath) return [];
    const base = normalizePath(projectPath);
    const ordered = [...novelChapters].sort((a, b) => a.sortOrder - b.sortOrder);
    const chapters: ChapterManuscript[] = [];
    for (const ch of ordered) {
      const sections = [...ch.sections].sort((a, b) => a.sortOrder - b.sortOrder);
      let body = '';
      for (const sec of sections) {
        const content = await window.orisonDesktop?.readFile(`${base}/${sec.contentFile}`);
        if (content) body += (body ? '\n\n' : '') + content;
      }
      chapters.push({ title: ch.title, body });
    }
    return chapters;
  };

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const chapters = await collectChapters();
      if (!chapters.some((chapter) => chapter.body.trim())) {
        showToast(t('export.empty'), 'error');
        return;
      }
      const filename = exportFilename(project?.name, format);

      if (format === 'md') {
        downloadBlob(new Blob([buildMarkdownManuscript(chapters)], { type: 'text/markdown' }), filename);
      } else if (format === 'txt') {
        downloadBlob(new Blob([buildPlainTextManuscript(chapters)], { type: 'text/plain' }), filename);
      } else if (format === 'docx') {
        downloadBlob(
          new Blob([buildDocxPackage(chapters)], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
          filename,
        );
      } else {
        // PDF: use browser print on plain text.
        const win = window.open('', '_blank');
        if (win) {
          const safe = buildPlainTextManuscript(chapters).replace(/</g, '&lt;');
          win.document.write(`<html><head><title>${filename}</title><style>body{font-family:serif;padding:2rem;line-height:1.6;}</style></head><body><pre style="white-space:pre-wrap;">${safe}</pre></body></html>`);
          win.document.close();
          win.print();
        }
      }
      onClose();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      showToast(`${t('export.failed')} — ${reason}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="dialog-title">{t('export.title')}</h2>
        <div className="export-format-options">
          {(['md', 'txt', 'docx', 'pdf'] as ExportFormat[]).map((f) => (
            <label key={f} className="export-format-option">
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
              <span>{f.toUpperCase()}</span>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { void handleExport(); }} disabled={busy}>
            {busy ? t('export.exporting') : t('export.download')}
          </button>
        </div>
      </div>
    </div>
  );
}
