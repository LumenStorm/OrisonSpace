import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CreativeFieldKey, ImageInput, ModelEntry, ModelProfile, SlotAssignment } from '@orison/shared-contracts';
import { generateImage } from '../../shared/api/generation';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { paramsToRequestPayload } from '../../shared/imageGen/schema';
import { ImageEditDialog } from './ImageEditDialog';
import { createImageName, fileNameOf, joinProjectPath, toDataUrl } from './imageGenUtils';

const GENERATION_IMAGE_DIR = 'temp/images/generation';
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PAGE_SIZE = 12;

export type GeneratedImageItem = {
  id: string;
  prompt: string;
  b64Json: string;
  mimeType: string;
  dataUrl: string;
  tempRelativePath: string;
  tempFullPath: string;
  savedRelativePath?: string;
  assetAdded: boolean;
  source: 'generated' | 'loaded' | 'edited';
  loading?: boolean;
};

type ResolvedSlot = {
  slot: SlotAssignment;
  profile: ModelProfile;
  entry: ModelEntry;
};

/**
 * Image-generation workspace.
 *
 * Flow: prompt → Generate → preview / save / promote-to-asset.
 */
export function ImageGenEditor() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const currentProject = useAppStore((s) => s.currentProject);
  const modelConfig = useAppStore((s) => s.modelConfig);
  const resolvedSlot = resolveImageSlot(modelConfig.profiles, modelConfig.selected.image);
  const creativeFields = useAppStore((s) => s.creativeFields);
  const updateField = useAppStore((s) => s.updateField);
  const appendOutputEntry = useAppStore((s) => s.appendOutputEntry);
  const imageGenParams = useAppStore((s) => s.imageGenParams);
  const imageGenFamily = useAppStore((s) => s.imageGenFamily);
  const reconcileImageGenForModel = useAppStore((s) => s.reconcileImageGenForModel);
  const { t } = useI18n(resolvedLocale);

  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<GeneratedImageItem[]>([]);
  const [preview, setPreview] = useState<GeneratedImageItem | null>(null);
  const [editing, setEditing] = useState<GeneratedImageItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<(ImageInput & { dataUrl: string }) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedPages = useRef<Set<string>>(new Set());

  useEffect(() => {
    reconcileImageGenForModel(resolvedSlot?.entry.id ?? null);
  }, [resolvedSlot?.entry.id, reconcileImageGenForModel]);

  useEffect(() => {
    hydratedPages.current = new Set();
    if (!currentProject?.path) {
      setResults([]);
      setPage(0);
      return;
    }

    let cancelled = false;
    const projectPath = currentProject.path;

    async function loadGenerationIndex() {
      try {
        const entries = await window.orisonDesktop.readDirectory(projectPath, 5);
        const generationDir = findFileTreeEntry(entries, `/${GENERATION_IMAGE_DIR}`);
        const imageFiles = (generationDir?.children ?? []).filter(
          (entry) => !entry.isDir && isReadableImagePath(entry.path),
        );

        const stubs: GeneratedImageItem[] = imageFiles
          .map((entry) => {
            const relativePath = entry.path.replace(/^\/+/, '');
            return {
              id: `loaded-${relativePath}`,
              prompt: fileNameOf(relativePath),
              b64Json: '',
              mimeType: 'image/png',
              dataUrl: '',
              tempRelativePath: relativePath,
              tempFullPath: joinProjectPath(projectPath, relativePath),
              assetAdded: false,
              source: 'loaded' as const,
              loading: true,
            } satisfies GeneratedImageItem;
          })
          .sort((a, b) => b.tempRelativePath.localeCompare(a.tempRelativePath));

        if (cancelled) return;
        setResults((current) => mergeGeneratedImages(current, stubs));
        setPage(0);
      } catch (err) {
        appendOutputEntry({
          scope: 'image',
          level: 'error',
          message: 'Failed to read generated image folder',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    void loadGenerationIndex();
    return () => { cancelled = true; };
  }, [appendOutputEntry, currentProject?.path]);

  // Hydrate the current page's stubs lazily — only read binaries for rows the
  // user can actually see. Runs whenever the visible slice changes.
  useEffect(() => {
    if (!currentProject?.path) return;

    const projectPath = currentProject.path;
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const targets = results.slice(start, end).filter((item) => item.loading && !item.b64Json);
    if (targets.length === 0) return;

    // Mark these ids as in-flight so a re-render caused by setResults below
    // doesn't kick off a second hydration for the same items.
    const claimed: string[] = [];
    for (const item of targets) {
      if (!hydratedPages.current.has(item.id)) {
        hydratedPages.current.add(item.id);
        claimed.push(item.id);
      }
    }
    if (claimed.length === 0) return;
    const claimedSet = new Set(claimed);

    let cancelled = false;
    (async () => {
      const hydrated = await Promise.all(
        targets
          .filter((item) => claimedSet.has(item.id))
          .map(async (item) => {
            try {
              const payload = await window.orisonDesktop.readFileBinary(item.tempFullPath);
              if (!payload) return { id: item.id, loading: false };
              return {
                id: item.id,
                b64Json: payload.base64,
                mimeType: payload.mimeType,
                dataUrl: toDataUrl(payload.base64, payload.mimeType),
                loading: false,
              };
            } catch (err) {
              appendOutputEntry({
                scope: 'image',
                level: 'error',
                message: 'Failed to read image',
                detail: err instanceof Error ? err.message : String(err),
              });
              return { id: item.id, loading: false };
            }
          }),
      );
      if (cancelled) return;
      const byId = new Map(hydrated.map((h) => [h.id, h]));
      setResults((current) =>
        current.map((item) => {
          const patch = byId.get(item.id);
          if (!patch) return item;
          return { ...item, ...patch };
        }),
      );
      void projectPath;
    })();

    return () => { cancelled = true; };
  }, [page, results, currentProject?.path, appendOutputEntry]);

  const canGenerate = !!currentProject?.path && !!prompt.trim() && !loading && !!resolvedSlot;
  const assetCards = useMemo(
    () => Array.isArray(creativeFields.asset_cards) ? creativeFields.asset_cards : [],
    [creativeFields.asset_cards],
  );

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(
    () => results.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE),
    [results, clampedPage],
  );

  const isEditMode = !!uploadedImage;

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('imageGen.uploadInvalidType'));
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setError(t('imageGen.uploadTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64Json = dataUrl.replace(/^data:[^;]+;base64,/, '');
      setUploadedImage({ b64Json, mimeType: file.type, dataUrl });
      setError(null);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    event.target.value = '';
  }

  async function handleGenerate() {
    if (!currentProject?.path || !prompt.trim() || !resolvedSlot) return;
    setLoading(true);
    setError(null);

    try {
      const payload = paramsToRequestPayload(imageGenParams, imageGenFamily);
      // In edit mode, force n=1 (API constraint for /images/edits)
      if (isEditMode) payload.n = 1;
      appendOutputEntry({
        scope: 'image',
        level: 'info',
        message: isEditMode ? 'Image edit request started' : 'Image generation request started',
        detail: `${resolvedSlot.profile.provider} · ${resolvedSlot.entry.alias} ${payload.size ?? imageGenParams.size} x${payload.n ?? imageGenParams.n}`,
      });

      const response = await generateImage({
        slot: resolvedSlot.slot,
        prompt: prompt.trim(),
        params: payload,
        image: uploadedImage ? { b64Json: uploadedImage.b64Json, mimeType: uploadedImage.mimeType } : undefined,
      });

      const saved = await Promise.all(
        response.images.map(async (image, index) => {
          if (!image.b64Json) {
            throw new Error(t('imageGen.missingBase64'));
          }

          const file = await window.orisonDesktop.saveBase64Image(currentProject.path, {
            b64Json: image.b64Json,
            mimeType: image.mimeType ?? 'image/png',
            directory: GENERATION_IMAGE_DIR,
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
            source: 'generated',
          } satisfies GeneratedImageItem;
        }),
      );

      setResults((current) => [...saved, ...current]);
      setPage(0);
      appendOutputEntry({
        scope: 'image',
        level: 'success',
        message: `Saved ${saved.length} generated image${saved.length === 1 ? '' : 's'} to ${GENERATION_IMAGE_DIR}`,
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

  async function promoteToAssetFile(item: GeneratedImageItem) {
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

  async function handleSaveEdit(
    item: GeneratedImageItem,
    payload: { b64Json: string; mimeType: string; maskB64Json?: string; intent: 'save' | 'generate' },
  ) {
    if (!currentProject?.path) return;
    if (payload.intent === 'generate') {
      await handleGenerateVariant(item, payload);
      return;
    }

    const editName = createImageName(`${fileNameOf(item.tempRelativePath)} edited`, 0);
    const editedFile = await window.orisonDesktop.saveBase64Image(currentProject.path, {
      b64Json: payload.b64Json,
      mimeType: payload.mimeType,
      directory: GENERATION_IMAGE_DIR,
      fileName: editName,
    });

    if (payload.maskB64Json) {
      await window.orisonDesktop.saveBase64Image(currentProject.path, {
        b64Json: payload.maskB64Json,
        mimeType: 'image/png',
        directory: GENERATION_IMAGE_DIR,
        fileName: `${editName}-mask`,
      });
    }

    const editedItem: GeneratedImageItem = {
      id: `edited-${Date.now()}`,
      prompt: `${item.prompt} edited`,
      b64Json: payload.b64Json,
      mimeType: payload.mimeType,
      dataUrl: toDataUrl(payload.b64Json, payload.mimeType),
      tempRelativePath: editedFile.relativePath,
      tempFullPath: editedFile.fullPath,
      assetAdded: false,
      source: 'edited',
    };

    setResults((current) => [editedItem, ...current]);
    setPage(0);
    setEditing(null);
    appendOutputEntry({
      scope: 'image',
      level: 'success',
      message: `Saved edited image to ${GENERATION_IMAGE_DIR}`,
      detail: editedFile.relativePath,
    });
  }

  /**
   * Send an edited image back to the image model as an edit request.
   * OpenAI → `/v1/images/edits` with mask honored.
   * Gemini image-edit adapters drop the mask and use the image as a
   * reference alongside the current prompt; the user is expected to describe
   * the intended change in the prompt textarea.
   */
  async function handleGenerateVariant(
    item: GeneratedImageItem,
    payload: { b64Json: string; mimeType: string; maskB64Json?: string },
  ) {
    if (!currentProject?.path || !resolvedSlot) return;
    const variantPrompt = prompt.trim() || item.prompt;
    if (!variantPrompt) {
      appendOutputEntry({
        scope: 'image',
        level: 'error',
        message: t('imageGen.generateFailed'),
        detail: 'Prompt is empty',
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = paramsToRequestPayload(imageGenParams, imageGenFamily);
      appendOutputEntry({
        scope: 'image',
        level: 'info',
        message: 'Image edit request started',
        detail: `${resolvedSlot.profile.provider} · ${resolvedSlot.entry.alias}`,
      });

      const response = await generateImage({
        slot: resolvedSlot.slot,
        prompt: variantPrompt,
        params,
        image: { b64Json: payload.b64Json, mimeType: payload.mimeType },
        mask: payload.maskB64Json
          ? { b64Json: payload.maskB64Json, mimeType: 'image/png' }
          : undefined,
      });

      const saved = await Promise.all(
        response.images.map(async (image, index) => {
          if (!image.b64Json) {
            throw new Error(t('imageGen.missingBase64'));
          }
          const file = await window.orisonDesktop.saveBase64Image(currentProject.path!, {
            b64Json: image.b64Json,
            mimeType: image.mimeType ?? 'image/png',
            directory: GENERATION_IMAGE_DIR,
            fileName: createImageName(`${variantPrompt} variant`, index),
          });
          return {
            id: `variant-${Date.now()}-${index}`,
            prompt: variantPrompt,
            b64Json: image.b64Json,
            mimeType: image.mimeType ?? 'image/png',
            dataUrl: image.dataUrl ?? toDataUrl(image.b64Json, image.mimeType ?? 'image/png'),
            tempRelativePath: file.relativePath,
            tempFullPath: file.fullPath,
            assetAdded: false,
            source: 'edited',
          } satisfies GeneratedImageItem;
        }),
      );

      setResults((current) => [...saved, ...current]);
      setPage(0);
      setEditing(null);
      appendOutputEntry({
        scope: 'image',
        level: 'success',
        message: `Saved ${saved.length} variant${saved.length === 1 ? '' : 's'} to ${GENERATION_IMAGE_DIR}`,
        detail: saved.map((entry) => entry.tempRelativePath).join(', '),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('imageGen.generateFailed');
      setError(message);
      appendOutputEntry({
        scope: 'image',
        level: 'error',
        message: 'Image edit request failed',
        detail: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAsset(item: GeneratedImageItem) {
    if (!currentProject?.path) return;
    let nextItem = item;
    if (!item.savedRelativePath) {
      await promoteToAssetFile(item);
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

  async function handleCopyPrompt(item: GeneratedImageItem) {
    try {
      await navigator.clipboard.writeText(item.prompt);
      appendOutputEntry({
        scope: 'image',
        level: 'success',
        message: t('imageGen.copied'),
        detail: item.prompt,
      });
    } catch (err) {
      appendOutputEntry({
        scope: 'image',
        level: 'error',
        message: t('imageGen.copyFailed'),
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleDelete(item: GeneratedImageItem) {
    if (!currentProject?.path) return;
    if (item.savedRelativePath) return;
    const confirmed = window.confirm(t('imageGen.deleteConfirm'));
    if (!confirmed) return;

    try {
      await window.orisonDesktop.deleteProjectFile(currentProject.path, item.tempRelativePath);
      setResults((current) => current.filter((entry) => entry.id !== item.id));
      appendOutputEntry({
        scope: 'image',
        level: 'success',
        message: 'Deleted generated image',
        detail: item.tempRelativePath,
      });
      if (preview?.id === item.id) setPreview(null);
    } catch (err) {
      appendOutputEntry({
        scope: 'image',
        level: 'error',
        message: t('imageGen.deleteFailed'),
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Preview navigation: Esc to close, ← / → across `results`.
  useEffect(() => {
    if (!preview) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPreview(null);
        return;
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const index = results.findIndex((item) => item.id === preview!.id);
      if (index < 0) return;
      const delta = e.key === 'ArrowLeft' ? -1 : 1;
      const next = results[(index + delta + results.length) % results.length];
      if (next) setPreview(next);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview, results]);

  return (
    <div className="image-gen-editor">
      <div className="image-gen-input-section">
        <div className="image-gen-profile-chip">
          {resolvedSlot ? (
            <>
              <span className="image-gen-profile-dot" aria-hidden="true" />
              <span className="image-gen-profile-name">{resolvedSlot.profile.provider}</span>
              <span className="image-gen-profile-model">· {resolvedSlot.entry.alias}</span>
            </>
          ) : (
            <span className="image-gen-profile-empty">{t('imageGen.noModel')}</span>
          )}
        </div>

        <div className="image-gen-prompt-surface">
          <textarea
            className="image-gen-prompt"
            placeholder={t('imageGen.promptPlaceholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
          />
          {uploadedImage ? (
            <div className="image-gen-upload-preview">
              <img className="image-gen-upload-thumb" src={uploadedImage.dataUrl} alt="" />
              <button
                type="button"
                className="image-gen-upload-remove"
                onClick={() => setUploadedImage(null)}
                aria-label={t('imageGen.removeUpload')}
                title={t('imageGen.removeUpload')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          ) : null}
          <div className="image-gen-prompt-footer">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="image-gen-upload-input"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              className="image-gen-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t('imageGen.uploadImage')}
              title={t('imageGen.uploadImage')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
            </button>
            <button
              type="button"
              className={loading ? 'image-gen-btn is-loading' : 'image-gen-btn'}
              disabled={!canGenerate}
              onClick={() => void handleGenerate()}
            >
              <span className="material-symbols-outlined image-gen-btn-icon" aria-hidden="true">
                {isEditMode ? 'edit' : 'auto_awesome'}
              </span>
              {loading
                ? (isEditMode ? t('imageGen.editing') : t('imageGen.generating'))
                : (isEditMode ? t('imageGen.editMode') : t('imageGen.generate'))}
            </button>
          </div>
        </div>

        {!currentProject?.path ? <p className="image-gen-empty">{t('imageGen.noProject')}</p> : null}
        {error ? (
          <div className="image-gen-error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="image-gen-error-dismiss"
              onClick={() => setError(null)}
              aria-label={t('imageGen.dismiss')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="image-gen-gallery-section">
        {results.length === 0 ? (
          <p className="image-gen-empty">{t('imageGen.noResults')}</p>
        ) : (
          <>
            <div className="image-gen-gallery">
              {pageItems.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  t={t}
                  onPreview={() => setPreview(item)}
                  onEdit={() => setEditing(item)}
                  onAddAsset={() => void handleAddAsset(item)}
                  onCopy={() => void handleCopyPrompt(item)}
                  onDelete={() => void handleDelete(item)}
                />
              ))}
            </div>
            {totalPages > 1 ? (
              <Pager
                page={clampedPage}
                total={totalPages}
                onChange={setPage}
                t={t}
              />
            ) : null}
          </>
        )}
      </div>

      {preview ? (
        <PreviewDialog
          item={preview}
          results={results}
          onClose={() => setPreview(null)}
          onSelect={(item) => setPreview(item)}
          onEdit={() => { setEditing(preview); setPreview(null); }}
          onAddAsset={() => void handleAddAsset(preview)}
          onCopy={() => void handleCopyPrompt(preview)}
          t={t}
        />
      ) : null}

      {editing ? (
        <ImageEditDialog
          item={editing}
          onCancel={() => setEditing(null)}
          onSave={(payload) => handleSaveEdit(editing, payload)}
        />
      ) : null}
    </div>
  );
}

type GalleryCardProps = {
  item: GeneratedImageItem;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onPreview: () => void;
  onEdit: () => void;
  onAddAsset: () => void;
  onCopy: () => void;
  onDelete: () => void;
};

function GalleryCard({ item, t, onPreview, onEdit, onAddAsset, onCopy, onDelete }: GalleryCardProps) {
  const badge = item.source === 'generated'
    ? { label: t('imageGen.badge.generated'), tone: 'new' as const }
    : item.source === 'edited'
      ? { label: t('imageGen.badge.edited'), tone: 'edited' as const }
      : null;

  const deleteDisabled = !!item.savedRelativePath;

  return (
    <article className="image-gen-card">
      <div className="image-gen-card-preview">
        {item.loading ? (
          <span className="image-gen-card-loading material-symbols-outlined" aria-hidden="true">
            progress_activity
          </span>
        ) : (
          <img src={item.dataUrl} alt={item.prompt} />
        )}

        {badge ? (
          <span className={`image-gen-card-badge is-${badge.tone}`}>{badge.label}</span>
        ) : null}
        {item.assetAdded ? (
          <span className="image-gen-card-asset-mark" title={t('imageGen.addedToAssets')}>
            <ImageActionIcon name="check" />
          </span>
        ) : null}

        <div className="image-gen-card-top-actions" aria-label={t('imageGen.actions')}>
          <button
            type="button"
            onClick={onPreview}
            aria-label={t('imageGen.preview')}
            title={t('imageGen.preview')}
          >
            <ImageActionIcon name="preview" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('imageGen.edit')}
            title={t('imageGen.edit')}
          >
            <ImageActionIcon name="edit" />
          </button>
          <button
            type="button"
            onClick={onAddAsset}
            disabled={item.assetAdded}
            aria-label={item.assetAdded ? t('imageGen.addedToAssets') : t('imageGen.addToAssets')}
            title={item.assetAdded ? t('imageGen.addedToAssets') : t('imageGen.addToAssets')}
          >
            <ImageActionIcon name={item.assetAdded ? 'check' : 'asset'} />
          </button>
          <button
            type="button"
            className="image-gen-card-danger"
            onClick={onDelete}
            disabled={deleteDisabled}
            aria-label={deleteDisabled ? t('imageGen.cannotDeleteAsset') : t('imageGen.delete')}
            title={deleteDisabled ? t('imageGen.cannotDeleteAsset') : t('imageGen.delete')}
          >
            <ImageActionIcon name="delete" />
          </button>
        </div>

        <div className="image-gen-card-prompt-row">
          <span className="image-gen-card-prompt" title={item.prompt}>{item.prompt}</span>
          <button
            type="button"
            className="image-gen-card-copy"
            onClick={onCopy}
            aria-label={t('imageGen.copyPrompt')}
            title={t('imageGen.copyPrompt')}
          >
            <ImageActionIcon name="copy" />
          </button>
        </div>
      </div>
    </article>
  );
}

type PagerProps = {
  page: number;
  total: number;
  onChange: (page: number) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

function Pager({ page, total, onChange, t }: PagerProps) {
  return (
    <nav className="image-gen-pager" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
      >
        {t('imageGen.pager.prev')}
      </button>
      <span className="image-gen-pager-status">
        {t('imageGen.pager.status', { current: page + 1, total })}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(total - 1, page + 1))}
        disabled={page >= total - 1}
      >
        {t('imageGen.pager.next')}
      </button>
    </nav>
  );
}

type PreviewDialogProps = {
  item: GeneratedImageItem;
  results: GeneratedImageItem[];
  onClose: () => void;
  onSelect: (item: GeneratedImageItem) => void;
  onEdit: () => void;
  onAddAsset: () => void;
  onCopy: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

function PreviewDialog({ item, results, onClose, onSelect, onEdit, onAddAsset, onCopy, t }: PreviewDialogProps) {
  const index = results.findIndex((entry) => entry.id === item.id);
  const hasNav = results.length > 1;
  const prev = () => {
    if (!hasNav) return;
    const next = results[(index - 1 + results.length) % results.length];
    if (next) onSelect(next);
  };
  const next = () => {
    if (!hasNav) return;
    const candidate = results[(index + 1) % results.length];
    if (candidate) onSelect(candidate);
  };

  return (
    <div className="image-preview-overlay" onClick={onClose}>
      <div className="image-preview-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="image-preview-close" onClick={onClose} aria-label={t('imageGen.dismiss')}>
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>

        {hasNav ? (
          <button
            type="button"
            className="image-preview-nav is-prev"
            onClick={prev}
            aria-label={t('imageGen.previousImage')}
          >
            <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
        ) : null}

        <img src={item.dataUrl} alt={item.prompt} />

        {hasNav ? (
          <button
            type="button"
            className="image-preview-nav is-next"
            onClick={next}
            aria-label={t('imageGen.nextImage')}
          >
            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
          </button>
        ) : null}

        <div className="image-preview-prompt-row">
          <span className="image-preview-prompt" title={item.prompt}>{item.prompt}</span>
          <button
            type="button"
            className="image-gen-card-copy"
            onClick={onCopy}
            aria-label={t('imageGen.copyPrompt')}
            title={t('imageGen.copyPrompt')}
          >
            <ImageActionIcon name="copy" />
          </button>
        </div>

        <div className="image-preview-actions">
          <button type="button" onClick={onEdit}>
            <ImageActionIcon name="edit" />
            <span>{t('imageGen.edit')}</span>
          </button>
          <button type="button" onClick={onAddAsset} disabled={item.assetAdded}>
            <ImageActionIcon name={item.assetAdded ? 'check' : 'asset'} />
            <span>{item.assetAdded ? t('imageGen.addedToAssets') : t('imageGen.addToAssets')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function resolveImageSlot(profiles: ModelProfile[], slot: SlotAssignment | null): ResolvedSlot | null {
  if (!slot) return null;
  const profile = profiles.find((p) => p.id === slot.profileId);
  if (!profile) return null;
  const entry = profile.models.find((m) => m.id === slot.modelId);
  if (!entry) return null;
  return { slot, profile, entry };
}

type FileTreeLike = Awaited<ReturnType<Window['orisonDesktop']['readDirectory']>>[number];

function findFileTreeEntry(entries: FileTreeLike[], targetPath: string): FileTreeLike | null {
  for (const entry of entries) {
    if (entry.path === targetPath) return entry;
    if (entry.children) {
      const found = findFileTreeEntry(entry.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function isReadableImagePath(value: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(value) && !/-mask\.(png|jpe?g|webp|gif|bmp)$/i.test(value);
}

function mergeGeneratedImages(current: GeneratedImageItem[], loaded: GeneratedImageItem[]): GeneratedImageItem[] {
  const existing = new Set(current.map((item) => item.tempRelativePath));
  return [...loaded.filter((item) => !existing.has(item.tempRelativePath)), ...current];
}

type ImageActionIconName = 'preview' | 'edit' | 'asset' | 'check' | 'copy' | 'delete';

function ImageActionIcon({ name }: { name: ImageActionIconName }) {
  const paths: Record<ImageActionIconName, ReactNode> = {
    preview: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" />
        <path d="m13.5 6 4.5 4.5" />
      </>
    ),
    asset: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="m8 15 2.5-3 2 2.3 2.5-3.3L18 15" />
        <circle cx="9" cy="8" r="1.2" />
      </>
    ),
    check: <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />,
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
      </>
    ),
    delete: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </>
    ),
  };

  return (
    <svg className="image-gen-action-svg" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
