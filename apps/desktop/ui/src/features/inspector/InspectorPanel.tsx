import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { moduleFields, aspectRatios } from '../../shared/data/inspectorFields';
import { PatchReviewPanel } from '../creative/PatchReviewPanel';

export function InspectorPanel() {
  const activeModule = useAppStore((s) => s.activeModule);
  const pendingPatch = useAppStore((s) => s.pendingPatch);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const modelConfig = useAppStore((s) => s.modelConfig);
  const setModelConfig = useAppStore((s) => s.setModelConfig);
  const { t, tArray } = useI18n(resolvedLocale);

  const showPatchReview = (activeModule === 'novel' || activeModule === 'script') && pendingPatch;

  const fields = moduleFields[activeModule] ?? [];
  const ratios = aspectRatios[activeModule] ?? [];
  const imageProfiles = modelConfig.profiles.filter((profile) => profile.capabilities.includes('image'));

  function updateImageModel(profileId: string) {
    const profile = imageProfiles.find((item) => item.id === profileId);
    useAppStore.getState().appendOutputEntry({
      scope: 'model',
      level: profile ? 'success' : 'info',
      message: profile ? `Selected image model: ${profile.name}` : 'Cleared image model selection',
      detail: profile ? `${profile.provider}/${profile.model}` : undefined,
    });
    void setModelConfig({
      ...modelConfig,
      selected: {
        ...modelConfig.selected,
        image: profileId || null,
      },
    });
  }

  return (
    <div className="inspector-content">
      <div className="inspector-module-label">
        {t('inspector.parameters', { module: activeModule.charAt(0).toUpperCase() + activeModule.slice(1) })}
      </div>
      {showPatchReview ? (
        <PatchReviewPanel />
      ) : (
        <div className="inspector-fields-row">
          {fields.map((field) => {
            if (field.kind === 'imageModel') {
              return (
                <label key={field.labelKey} className="inspector-field-item">
                  <div className="inspector-label">{t(field.labelKey)}</div>
                  <select
                    className="inspector-select"
                    value={modelConfig.selected.image ?? ''}
                    onChange={(event) => updateImageModel(event.target.value)}
                  >
                    <option value="">{t('settings.modelSelectPlaceholder')}</option>
                    {imageProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} / {profile.model}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

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
