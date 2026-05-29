import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type ExportFormat = 'md' | 'txt' | 'pdf';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1');
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { chapters, resolvedLocale } = useAppStore(useShallow((s) => ({
    chapters: s.chapters,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);
  const [format, setFormat] = useState<ExportFormat>('md');

  const handleExport = () => {
    const combined = chapters.map((c) => `# ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
    const filename = `export.${format === 'pdf' ? 'pdf' : format}`;

    if (format === 'md') {
      downloadBlob(new Blob([combined], { type: 'text/markdown' }), filename);
    } else if (format === 'txt') {
      downloadBlob(new Blob([stripMarkdown(combined)], { type: 'text/plain' }), filename);
    } else {
      // PDF: use browser print
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><head><title>Export</title><style>body{font-family:serif;padding:2rem;line-height:1.6;}</style></head><body><pre style="white-space:pre-wrap;">${combined.replace(/</g, '&lt;')}</pre></body></html>`);
        win.document.close();
        win.print();
      }
    }
    onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="dialog-title">{t('export.title') || 'Export'}</h2>
        <div className="export-format-options">
          {(['md', 'txt', 'pdf'] as ExportFormat[]).map((f) => (
            <label key={f} className="export-format-option">
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
              <span>{f.toUpperCase()}</span>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel') || 'Cancel'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            {t('export.download') || 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
