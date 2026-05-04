import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import {
  IMAGE_FAMILIES,
  isCompressionMeaningful,
  supportsCustomSize,
  type ImageBackground,
  type ImageGenField,
  type ImageModeration,
  type ImageOutputFormat,
  type ImageQuality,
} from '../../shared/imageGen/schema';
import { ProfileField } from './image-gen-fields/ProfileField';
import { SelectField } from './image-gen-fields/SelectField';
import { CUSTOM_SIZE_OPTION, SizeField } from './image-gen-fields/SizeField';

/**
 * Inspector panel rendered when `activeModule === 'image_gen'`. It is the
 * single source of truth for image-generation parameters; the editor reads
 * them from the same store and does not render any parameter controls.
 *
 * Field visibility is driven by the active model's family (see
 * `shared/imageGen/schema.ts`).
 */
export function ImageGenInspector() {
  const {
    resolvedLocale,
    modelConfig,
    setModelConfig,
    family,
    params,
    customSize,
    setImageGenParam,
    setImageGenCustomSize,
    setImageGenCustomDimensions,
    reconcile,
    appendOutputEntry,
  } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    modelConfig: s.modelConfig,
    setModelConfig: s.setModelConfig,
    family: s.imageGenFamily,
    params: s.imageGenParams,
    customSize: s.imageGenCustomSize,
    setImageGenParam: s.setImageGenParam,
    setImageGenCustomSize: s.setImageGenCustomSize,
    setImageGenCustomDimensions: s.setImageGenCustomDimensions,
    reconcile: s.reconcileImageGenForModel,
    appendOutputEntry: s.appendOutputEntry,
  })));

  const { t } = useI18n(resolvedLocale);
  const imageProfiles = modelConfig.profiles.filter((profile) => profile.capabilities.includes('image'));
  const selectedProfile = imageProfiles.find((p) => p.id === modelConfig.selected.image) ?? null;

  // Placeholder text differs by state so the user gets a useful next step
  // instead of the misleading "fetch models first" copy that was originally
  // designed for the settings page's remote-model refresh flow.
  const placeholderText = (() => {
    if (modelConfig.profiles.length === 0) return t('imageGen.params.noProfilesYet');
    if (imageProfiles.length === 0) return t('imageGen.params.noImageProfile');
    return t('imageGen.params.selectModel');
  })();

  // Re-sanitize params whenever the selected model string changes — the user
  // may have edited the profile's model name in settings without changing the
  // selection.
  useEffect(() => {
    reconcile(selectedProfile?.model ?? null);
  }, [selectedProfile?.model, reconcile]);

  const spec = IMAGE_FAMILIES[family];
  const visible = (field: ImageGenField) => spec.fields.includes(field);

  function handleProfileChange(profileId: string) {
    const profile = imageProfiles.find((p) => p.id === profileId) ?? null;
    appendOutputEntry({
      scope: 'model',
      level: profile ? 'success' : 'info',
      message: profile ? `Selected image model: ${profile.name}` : 'Cleared image model selection',
      detail: profile ? `${profile.provider}/${profile.model}` : undefined,
    });
    void setModelConfig({
      ...modelConfig,
      selected: { ...modelConfig.selected, image: profileId || null },
    });
    // The effect above will reconcile on profile.model change; do it eagerly
    // here too so the new family is reflected before the next render.
    reconcile(profile?.model ?? null);
  }

  return (
    <div className="inspector-content">
      <div className="inspector-module-label">
        {t('inspector.parameters', { module: 'Image Gen' })}
      </div>

      <div className="inspector-fields-row">
        <ProfileField
          profiles={imageProfiles}
          selectedId={modelConfig.selected.image ?? ''}
          onChange={handleProfileChange}
          label={t('imageGen.params.model')}
          placeholder={placeholderText}
        />

        {visible('size') && (
          <SizeField
            t={t}
            value={params.size}
            customSize={customSize}
            options={spec.size.options}
            supportsCustom={supportsCustomSize(family)}
            onPresetChange={(next) => {
              if (next === CUSTOM_SIZE_OPTION) {
                setImageGenCustomSize(true);
              } else {
                setImageGenParam('size', next);
              }
            }}
            onCustomDimensionsChange={(w, h) => setImageGenCustomDimensions(w, h)}
          />
        )}

        {visible('n') && (
          <SelectField
            label={t('imageGen.params.count')}
            value={String(params.n)}
            options={range(spec.n.min, spec.n.max).map(String)}
            onChange={(v) => setImageGenParam('n', Number(v))}
          />
        )}

        {visible('quality') && spec.quality && (
          <SelectField
            label={t('imageGen.params.quality')}
            value={params.quality ?? spec.quality.default}
            options={spec.quality.options}
            optionLabel={(o) => t(`imageGen.params.qualityValue.${o}`)}
            onChange={(v) => setImageGenParam('quality', v as ImageQuality)}
          />
        )}

        {visible('outputFormat') && spec.outputFormat && (
          <SelectField
            label={t('imageGen.params.outputFormat')}
            value={params.outputFormat ?? spec.outputFormat.default}
            options={spec.outputFormat.options}
            onChange={(v) => setImageGenParam('outputFormat', v as ImageOutputFormat)}
          />
        )}

        {visible('background') && spec.background && (
          <SelectField
            label={t('imageGen.params.background')}
            value={params.background ?? spec.background.default}
            options={spec.background.options}
            optionLabel={(o) => t(`imageGen.params.backgroundValue.${o}`)}
            onChange={(v) => setImageGenParam('background', v as ImageBackground)}
          />
        )}

        {visible('moderation') && spec.moderation && (
          <SelectField
            label={t('imageGen.params.moderation')}
            value={params.moderation ?? spec.moderation.default}
            options={spec.moderation.options}
            optionLabel={(o) => t(`imageGen.params.moderationValue.${o}`)}
            onChange={(v) => setImageGenParam('moderation', v as ImageModeration)}
          />
        )}

        {visible('outputCompression') &&
          spec.outputCompression &&
          isCompressionMeaningful(params.outputFormat) && (
            <label className="inspector-field-item">
              <div className="inspector-label">
                {t('imageGen.params.outputCompression')}
                <span className="image-gen-inspector-hint">
                  {' '}
                  {params.outputCompression ?? spec.outputCompression.default}
                </span>
              </div>
              <input
                type="range"
                className="image-gen-inspector-slider"
                min={spec.outputCompression.min}
                max={spec.outputCompression.max}
                step={1}
                value={params.outputCompression ?? spec.outputCompression.default}
                onChange={(e) => setImageGenParam('outputCompression', Number(e.target.value))}
              />
            </label>
          )}

        {visible('user') && (
          <label className="inspector-field-item">
            <div className="inspector-label">{t('imageGen.params.user')}</div>
            <input
              type="text"
              className="inspector-select"
              placeholder={t('imageGen.params.userPlaceholder')}
              value={params.user ?? ''}
              onChange={(e) => setImageGenParam('user', e.target.value)}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function range(min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = min; i <= max; i += 1) out.push(i);
  return out;
}
