import { useEffect, useMemo, useState } from 'react';
import type { CreativeFieldKey } from '@orison/shared-contracts';
import type { ModelProfile } from '@orison/shared-contracts';
import { generateImage } from '../../shared/api/generation';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { paramsToRequestPayload } from '../../shared/imageGen/schema';
import { createImageName, fileNameOf, joinProjectPath, toDataUrl } from './imageGenUtils';

type GeneratedImageItem = {
  id: string;
  prompt: string;
  b64Json: string;
  mimeType: string;
  dataUrl: string;
  tempRelativePath: string;
  tempFullPath: string;
  savedRelativePath?: string;
  assetAdded: boolean;
};

/**
 * Image-generation workspace.
 *
 * Flow: prompt → Generate → preview / save / promote-to-asset.
 *
 * Generation parameters (size, n, quality, background, output format,
 * compression, moderation, user) are owned by the bottom Properties panel via
 * `imageGenSlice`. This component is intentionally parameter-free; if the user
 * has the bottom panel collapsed, sensible defaults still apply.
 */
export function ImageGenEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const token = useAppStore((s) => s.token);
  const currentProject = useAppStore((s) => s.currentProject);
  const modelConfig = useAppStore((s) => s.modelConfig);
  const imageModel = getSelectedProfile(modelConfig.profiles, modelConfig.selected.image);
  const creativeFields = useAppStore((s) => s.creativeFields);
  const updateField = useAppStore((s) => s.updateField);
  const appendOutputEntry = useAppStore((s) => s.appendOutputEntry);
  const imageGenParams = useAppStore((s) => s.imageGenParams);
  const imageGenFamily = useAppStore((s) => s.imageGenFamily);
  const reconcileImageGenForModel = useAppStore((s) => s.reconcileImageGenForModel);
  const bottomPanelOpen = useAppStore((s) => s.bottomPanelOpen);
  const activeBottomTab = useAppStore((s) => s.activeBottomTab);
  const toggleBottomPanel = useAppStore((s) => s.toggleBottomPanel);
  const setActiveBottomTab = useAppStore((s) => s.setActiveBottomTab);
  const { t } = useI18n(resolvedLocale);

  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<GeneratedImageItem[]>([]);
  const [preview, setPreview] = useState<GeneratedImageItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the slice's family in sync with the currently selected profile's
  // model string. The Inspector also reconciles, but the editor may render
  // first when the bottom panel is collapsed.
  useEffect(() => {
    reconcileImageGenForModel(imageModel?.model ?? null);
  }, [imageModel?.model, reconcileImageGenForModel]);

  const canGenerate = !!currentProject?.path && !!prompt.trim() && !loading && !!imageModel;
  const assetCards = useMemo(
    () => Array.isArray(creativeFields.asset_cards) ? creativeFields.asset_cards : [],
    [creativeFields.asset_cards],
  );

  function openParameters() {
    if (!bottomPanelOpen) toggleBottomPanel();
    setActiveBottomTab('properties');
  }

  // The button is only useful when the user can't already see the inspector.
  // If the bottom panel is open AND the properties tab is active, the params
  // are already on screen — rendering the button would be a no-op and feels
  // broken when clicked.
  const inspectorAlreadyVisible = bottomPanelOpen && activeBottomTab === 'properties';

  async function handleGenerate() {
    if (!currentProject?.path || !prompt.trim() || !imageModel) return;
    setLoading(true);
    setError(null);

    try {
      const payload = paramsToRequestPayload(imageGenParams, imageGenFamily);
      appendOutputEntry({
        scope: 'image',
        level: 'info',
        message: 'Image generation request started',
        detail: `${imageModel.provider}/${imageModel.model} ${payload.size ?? imageGenParams.size} x${payload.n ?? imageGenParams.n}`,
      });

      const response = await generateImage({
        slot: imageModel,
        prompt: prompt.trim(),
        token,
        params: payload,
      });

      const saved = await Promise.all(
        response.images.map(async (image, index) => {
          if (!image.b64Json) {
            throw new Error(t('imageGen.missingBase64'));
          }

          const file = await window.orisonDesktop.saveBase64Image(currentProject.path, {
            b64Json: image.b64Json,
            mimeType: image.mimeType ?? 'image/png',
            directory: 'temp/images',
            fileName: createImageName(prompt, index),
          });

          return {
            id: `${Date.now()}-${index}`,
            prompt: prompt.trim(),
            b64Json: image.b64Json,
            mimeType: image.mimeType ?? 'image/png',
            dataUrl: image.dataUrl ?? toDataUrl(image.b64Json, image.mimeType ?? 'image/png'),
            tempRelativePath: file.relativePath,
            tempFullPath: file.fullPath,
            assetAdded: false,
          } satisfies GeneratedImageItem;
        }),
      );

      setResults((current) => [...saved, ...current]);
      appendOutputEntry({
        scope: 'image',
        level: 'success',
        message: `Saved ${saved.length} generated image${saved.length === 1 ? '' : 's'} to temp/images`,
        detail: saved.map((item) => item.tempRelativePath).join(', '),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('imageGen.generateFailed');
      setError(message);
      appendOutputEntry({
        scope: 'image',
        level: 'error',
        message: 'Image generation failed',
        detail: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(item: GeneratedImageItem) {
    if (!currentProject?.path || item.savedRelativePath) return;
    const targetRelativePath = `assets/images/${fileNameOf(item.tempRelativePath)}`;
    await window.orisonDesktop.moveProjectFile(currentProject.path, item.tempRelativePath, targetRelativePath);
    appendOutputEntry({
      scope: 'image',
      level: 'success',
      message: 'Moved generated image to assets/images',
      detail: targetRelativePath,
    });
    setResults((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, savedRelativePath: targetRelativePath, tempFullPath: joinProjectPath(currentProject.path, targetRelativePath) }
          : entry
      ),
    );
  }

  async function handleAddAsset(item: GeneratedImageItem) {
    if (!currentProject?.path) return;
    let nextItem = item;
    if (!item.savedRelativePath) {
      await handleSave(item);
      nextItem = { ...item, savedRelativePath: `assets/images/${fileNameOf(item.tempRelativePath)}` };
    }

    const assetCard = {
      id: `image_${Date.now()}`,
      type: 'image',
      name: nextItem.prompt.slice(0, 48) || t('imageGen.generatedImage'),
      summary: nextItem.prompt,
      tags: ['generated'],
      relationships: [],
      sourceRefs: [nextItem.savedRelativePath],
      status: 'active',
      locked: false,
    };

    updateField('asset_cards' as CreativeFieldKey, [...assetCards, assetCard]);
    setResults((current) =>
      current.map((entry) => entry.id === item.id ? { ...entry, assetAdded: true } : entry),
    );
  }

  return (
    <div className="image-gen-editor">
      <div className="image-gen-input-section">
        <h3 className="image-gen-section-title">{t('imageGen.title')}</h3>

        <div className="image-gen-profile-chip">
          {imageModel ? (
            <>
              <span className="image-gen-profile-dot" aria-hidden="true" />
              <span className="image-gen-profile-name">{imageModel.name}</span>
              <span className="image-gen-profile-model">· {imageModel.model}</span>
            </>
          ) : (
            <span className="image-gen-profile-empty">{t('imageGen.noModel')}</span>
          )}
          {!inspectorAlreadyVisible && (
            <button
              type="button"
              className="image-gen-profile-link"
              onClick={openParameters}
            >
              {t('imageGen.openParameters')}
            </button>
          )}
        </div>

        <textarea
          className="image-gen-prompt"
          placeholder={t('imageGen.promptPlaceholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
        />

        <div className="image-gen-actions">
          <button type="button" className="image-gen-btn" disabled={!canGenerate} onClick={() => void handleGenerate()}>
            <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
            {loading ? t('imageGen.generating') : t('imageGen.generate')}
          </button>
        </div>
        {!currentProject?.path ? <p className="image-gen-error">{t('imageGen.noProject')}</p> : null}
        {error ? <p className="image-gen-error">{error}</p> : null}
      </div>

      <div className="image-gen-gallery-section">
        <h3 className="image-gen-section-title">{t('imageGen.results')}</h3>
        {results.length === 0 ? (
          <p className="image-gen-empty">{t('imageGen.noResults')}</p>
        ) : (
          <div className="image-gen-gallery">
            {results.map((item) => (
              <article key={item.id} className="image-gen-card">
                <button type="button" className="image-gen-card-preview" onClick={() => setPreview(item)}>
                  <img src={item.dataUrl} alt={item.prompt} />
                </button>
                <div className="image-gen-card-body">
                  <span className="image-gen-card-label">{item.prompt}</span>
                  <div className="image-gen-card-actions">
                    <button type="button" onClick={() => setPreview(item)}>{t('imageGen.preview')}</button>
                    <button type="button" onClick={() => void handleSave(item)} disabled={!!item.savedRelativePath}>
                      {item.savedRelativePath ? t('imageGen.saved') : t('imageGen.saveToFile')}
                    </button>
                    <button type="button" onClick={() => void handleAddAsset(item)} disabled={item.assetAdded}>
                      {item.assetAdded ? t('imageGen.addedToAssets') : t('imageGen.addToAssets')}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {preview ? (
        <div className="image-preview-overlay" onClick={() => setPreview(null)}>
          <div className="image-preview-dialog" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="image-preview-close" onClick={() => setPreview(null)} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
            <img src={preview.dataUrl} alt={preview.prompt} />
            <p>{preview.prompt}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSelectedProfile(profiles: ModelProfile[], selectedId: string | null): ModelProfile | null {
  return profiles.find((profile) => profile.id === selectedId) ?? null;
}
