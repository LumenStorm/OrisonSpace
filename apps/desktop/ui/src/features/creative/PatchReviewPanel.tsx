import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function PatchReviewPanel() {
  const {
    pendingPatch, patchSelections,
    togglePatchSelection, applySelectedPatches, setPendingPatch,
    resolvedLocale
  } = useAppStore(useShallow((s) => ({
    pendingPatch: s.pendingPatch,
    patchSelections: s.patchSelections,
    togglePatchSelection: s.togglePatchSelection,
    applySelectedPatches: s.applySelectedPatches,
    setPendingPatch: s.setPendingPatch,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);

  if (!pendingPatch) return null;

  const actionLabels: Record<string, string> = {
    set: t('creative.patch.set'),
    merge: t('creative.patch.merge'),
    delete: t('creative.patch.delete'),
  };

  return (
    <div className="patch-review" aria-label="Patch Review">
      <h4 className="patch-review-title">{t('creative.patch.title')}</h4>
      <p className="patch-review-meta">Run: {pendingPatch.runId}</p>
      <div className="patch-review-list">
        {pendingPatch.patches.map((entry) => (
          <label key={entry.field} className="patch-review-item">
            <input
              type="checkbox"
              checked={patchSelections[entry.field] ?? false}
              onChange={() => togglePatchSelection(entry.field)}
            />
            <span className="patch-review-field">{t(`creative.tabs.${entry.field}`)}</span>
            <span className="patch-review-action">{actionLabels[entry.action] ?? entry.action}</span>
            <span className="patch-review-agent">{entry.generatedBy}</span>
          </label>
        ))}
      </div>
      <div className="patch-review-actions">
        <button
          type="button"
          className="inspector-cta"
          onClick={() => applySelectedPatches()}
        >
          {t('creative.patch.applySelected')}
        </button>
        <button
          type="button"
          className="patch-review-reject-btn"
          onClick={() => setPendingPatch(null)}
        >
          {t('creative.patch.rejectAll')}
        </button>
      </div>
    </div>
  );
}
