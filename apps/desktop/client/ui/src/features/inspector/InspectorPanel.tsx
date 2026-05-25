import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { moduleFields, aspectRatios } from '../../shared/data/inspectorFields';
import { PatchReviewPanel } from '../creative/PatchReviewPanel';
import { ImageGenInspector } from './ImageGenInspector';

/** @deprecated No longer rendered in bottom panel */
export function InspectorPanel() {
  const activePage = useAppStore((s) => s.activePage);
  const pendingPatch = useAppStore((s) => s.pendingPatch);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t, tArray } = useI18n(resolvedLocale);

  const showPatchReview = (activePage === 'novel' || activePage === 'script') && pendingPatch;

  if (activePage === 'image_gen' && !showPatchReview) {
    return <ImageGenInspector />;
  }

  const fields = moduleFields[activePage] ?? [];
  const ratios = aspectRatios[activePage] ?? [];

  return (
    <div className="inspector-content">
      <div className="inspector-module-label">
        {t('inspector.parameters', { module: activePage.charAt(0).toUpperCase() + activePage.slice(1) })}
      </div>
      {showPatchReview ? (
        <PatchReviewPanel />
      ) : (
        <div className="inspector-fields-row">
          {fields.map((field) => {
            const options = tArray(field.optionsKey);
            return (
              <label key={field.labelKey} className="inspector-field-item">
                <div className="inspector-label">{t(field.labelKey)}</div>
                <select className="inspector-select" defaultValue={options[field.defaultIndex] ?? ''}>
                  {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            );
          })}
          {ratios.length > 0 && (
            <div className="inspector-field-item">
              <div className="inspector-label">{t('inspector.aspectRatio')}</div>
              <div className="inspector-segmented" role="group" aria-label={t('inspector.aspectRatio')}>
                {ratios.map((r, i) => (
                  <button
                    key={r}
                    className={`inspector-segment${i === 0 ? ' inspector-segmentActive' : ''}`}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
