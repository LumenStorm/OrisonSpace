import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ModelRef } from '@orison/shared-contracts';
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
 */
export function ImageGenInspector() {
  const {
    resolvedLocale,
    modelConfig,
    family,
    params,
    customSize,
    selectedImageRef,
    setSelectedImageRef,
    setImageGenParam,
    setImageGenCustomSize,
    setImageGenCustomDimensions,
    reconcile,
    appendOutputEntry,
  } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    modelConfig: s.modelConfig,
    family: s.imageGenFamily,
    params: s.imageGenParams,
    customSize: s.imageGenCustomSize,
    selectedImageRef: s.selectedImageRef,
    setSelectedImageRef: s.setSelectedImageRef,
    setImageGenParam: s.setImageGenParam,
    setImageGenCustomSize: s.setImageGenCustomSize,
    setImageGenCustomDimensions: s.setImageGenCustomDimensions,
    reconcile: s.reconcileImageGenForModel,
    appendOutputEntry: s.appendOutputEntry,
  })));

  const { t } = useI18n(resolvedLocale);
  const keys = modelConfig.keys;
  const selectedModelId = selectedImageRef?.modelId ?? null;

  const placeholderText = (() => {
    if (keys.length === 0) return t('imageGen.params.noProfilesYet');
    const hasImage = keys.some((k) => k.models.some((m) => m.enabled && m.capability === 'image'));
    if (!hasImage) return t('imageGen.params.noImageProfile');
    return t('imageGen.params.selectModel');
  })();

  useEffect(() => {
    reconcile(selectedModelId);
  }, [selectedModelId, reconcile]);

  const spec = IMAGE_FAMILIES[family];
  const visible = (field: ImageGenField) => spec.fields.includes(field);

  function handleProfileChange(ref: ModelRef | null) {
    if (ref) {
      const key = keys.find((k) => k.id === ref.keyId);
      const model = key?.models.find((m) => m.id === ref.modelId);
      appendOutputEntry({
        scope: 'model',
        level: 'success',
        message: model ? `Selected image model: ${key!.name} · ${model.alias}` : 'Selected image model',
        detail: model ? `${key!.name}/${model.id}` : undefined,
      });
    } else {
      appendOutputEntry({
        scope: 'model',
        level: 'info',
        message: 'Cleared image model selection',
      });
    }
    setSelectedImageRef(ref);
  }

  return (
    <div className="inspector-content">
      <div className="inspector-module-label">
        {t('inspector.parameters', { module: 'Image Gen' })}
      </div>

      <div className="inspector-fields-row">
        <ProfileField
          keys={keys}
          selectedRef={selectedImageRef}
          onChange={handleProfileChange}
          label={t('imageGen.params.model')}
          placeholder={placeholderText}
          capability="image"
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
