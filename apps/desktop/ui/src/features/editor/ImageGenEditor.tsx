import { useMemo, useState } from 'react';
import type { CreativeFieldKey } from '@orison/shared-contracts';
import { generateImage } from '../../shared/api/generation';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

const IMAGE_SIZES = ['1024x1024', '1024x1792', '1792x1024'] as const;
const IMAGE_COUNTS = [1, 2, 4] as const;

type GeneratedImageItem = {
  id: string;
  prompt: string;
  b64Json: string;
  mimeType: string;
  tempRelativePath: string;
  tempFullPath: string;
  savedRelativePath?: string;
  assetAdded: boolean;
};

export function ImageGenEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const token = useAppStore((s) => s.token);
  const currentProject = useAppStore((s) => s.currentProject);
  const imageModel = useAppStore((s) => s.modelConfig.models.image);
  const creativeFields = useAppStore((s) => s.creativeFields);
  const updateField = useAppStore((s) => s.updateField);
  const { t } = useI18n(resolvedLocale);

  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<(typeof IMAGE_SIZES)[number]>('1024x1024');
  const [count, setCount] = useState<(typeof IMAGE_COUNTS)[number]>(1);
  const [results, setResults] = useState<GeneratedImageItem[]>([]);
  const [preview, setPreview] = useState<GeneratedImageItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = !!currentProject?.path && !!prompt.trim() && !loading;
  const assetCards = useMemo(
    () => Array.isArray(creativeFields.asset_cards) ? creativeFields.asset_cards : [],
    [creativeFields.asset_cards],
  );

  async function handleGenerate() {
    if (!currentProject?.path || !prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await generateImage({
        slot: imageModel,
        prompt: prompt.trim(),
        size,
        n: count,
        token,
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
            tempRelativePath: file.relativePath,
            tempFullPath: file.fullPath,
            assetAdded: false,
          } satisfies GeneratedImageItem;
        }),
      );

      setResults((current) => [...saved, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('imageGen.generateFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(item: GeneratedImageItem) {
    if (!currentProject?.path || item.savedRelativePath) return;
    const targetRelativePath = `assets/images/${item.tempRelativePath.split('/').pop()}`;
    await window.orisonDesktop.moveProjectFile(currentProject.path, item.tempRelativePath, targetRelativePath);
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
      nextItem = { ...item, savedRelativePath: `assets/images/${item.tempRelativePath.split('/').pop()}` };
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
        <textarea
          className="image-gen-prompt"
          placeholder={t('imageGen.promptPlaceholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
        />

        <div className="image-gen-controls">
          <label className="image-gen-control">
            <span>{t('imageGen.size')}</span>
            <select value={size} onChange={(e) => setSize(e.target.value as typeof size)}>
              {IMAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="image-gen-control">
            <span>{t('imageGen.count')}</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value) as typeof count)}>
              {IMAGE_COUNTS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

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
                  <img src={`file://${item.tempFullPath}`} alt={item.prompt} />
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
            <img src={`file://${preview.tempFullPath}`} alt={preview.prompt} />
            <p>{preview.prompt}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function createImageName(prompt: string, index: number): string {
  const slug = prompt.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 36);
  return `${slug || 'image'}-${index + 1}-${Date.now()}`;
}

function joinProjectPath(projectPath: string, relativePath: string): string {
  return `${projectPath.replace(/[\\/]+$/, '')}\\${relativePath.replace(/\//g, '\\')}`;
}
