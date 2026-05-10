import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { z } from 'zod';
import type { assetCardsSchema } from '@orison/shared-contracts';
import { supportedAssetArchiveTypes } from '@orison/shared-contracts';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type AssetCard = z.infer<typeof assetCardsSchema>[number];
type SupportedType = (typeof supportedAssetArchiveTypes)[number];

const SUPPORTED_SET = new Set<string>(supportedAssetArchiveTypes);
const ZH_ARCHIVE_COPY: Record<string, string> = {
  createCharacter: '新建角色',
  createLocation: '新建地点',
  createProp: '新建道具',
  newCharacterName: '新角色',
  newLocationName: '新地点',
  newPropName: '新道具',
  noSummary: '暂无摘要',
  legacyTitle: '兼容旧资产卡',
  generateImage: '生成图片',
  addGalleryImage: '添加图库图片',
  saveDossier: '保存档案',
  deleteArchive: '删除档案',
  deleteConfirmTitle: '确认删除档案',
  deleteConfirmBody: '删除后将同时移除档案文件和关联图片，且不可恢复。',
  confirmDelete: '确认删除',
  cancelDelete: '取消',
  galleryTitle: '图像档案',
  noImages: '暂未附加图片',
  'field.name': '名称',
  'field.summary': '摘要',
  'field.tags': '标签',
  'field.firstAppearance': '首次登场',
  'field.role': '角色定位',
  'field.occupation': '身份职业',
  'field.personality': '性格特征',
  'field.motivation': '核心动机',
  'field.category': '分类',
  'field.region': '所属区域',
  'field.atmosphere': '氛围',
  'field.rules': '规则',
  'field.owner': '持有者',
  'field.function': '功能',
  'field.risk': '风险',
  'type.character': '角色',
  'type.location': '地点',
  'type.prop': '道具',
  'status.draft': '草稿',
  'status.active': '启用',
  'status.locked': '锁定',
  'status.archived': '归档',
  'imageKind.primary': '主图',
  'imageKind.portrait': '肖像',
  'imageKind.full_body': '全身',
  'imageKind.scene_reference': '场景参考',
  'imageKind.prop_detail': '道具细节',
  'imageKind.costume': '服装参考',
  'imageKind.mood': '氛围图',
};

export function AssetCardsList() {
  const data = useAppStore((s) => s.creativeFields.asset_cards) as AssetCard[] | undefined;
  const currentProject = useAppStore((s) => s.currentProject);
  const updateField = useAppStore((s) => s.updateField);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setAssetArchiveTarget = useAppStore((s) => s.setAssetArchiveTarget);
  const setImageGenPrompt = useAppStore((s) => s.setImageGenPrompt);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);
  const archiveT = (key: string) => assetArchiveMessage(resolvedLocale, t, key);

  const allCards = Array.isArray(data) ? data : [];
  const archiveCards = useMemo(
    () => allCards.filter((card): card is AssetCard & { type: SupportedType } => isSupportedType(card.type)),
    [allCards],
  );
  const legacyCards = useMemo(
    () => allCards.filter((card) => !isSupportedType(card.type)),
    [allCards],
  );

  const [selectedId, setSelectedId] = useState<string | null>(archiveCards[0]?.id ?? null);
  const selectedCard = archiveCards.find((card) => card.id === selectedId) ?? archiveCards[0] ?? null;
  const [draft, setDraft] = useState<AssetCard | null>(selectedCard ? cloneCard(selectedCard) : null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCard) {
      setSelectedId(archiveCards[0]?.id ?? null);
      setDraft(archiveCards[0] ? cloneCard(archiveCards[0]) : null);
      setShowDeleteConfirm(false);
      return;
    }

    setSelectedId(selectedCard.id);
    setDraft(cloneCard(selectedCard));
  }, [archiveCards, selectedCard?.id]);

  function saveDraft(nextDraft = draft) {
    if (!nextDraft) return;
    const exists = allCards.some((card) => card.id === nextDraft.id);
    const nextCards = exists
      ? allCards.map((card) => (card.id === nextDraft.id ? normalizeCard(nextDraft) : card))
      : [...allCards, normalizeCard(nextDraft)];
    updateField('asset_cards', nextCards);
  }

  function createArchiveCard(type: SupportedType) {
    const card = normalizeCard({
      id: `${type}_${Date.now()}`,
      type,
      name: defaultArchiveName(type, archiveT),
      summary: '',
      details: {
        profile: {},
        ...(type === 'character' ? { persona: {} } : {}),
        ...(type === 'location' ? { setting: {} } : {}),
        story: {},
      },
      tags: [],
      relationships: [],
      sourceRefs: [],
      status: 'draft',
      locked: false,
    } as AssetCard);

    updateField('asset_cards', [...allCards, card]);
    setSelectedId(card.id);
    setDeleteError(null);
  }

  function launchImageGeneration(mode: 'primary' | 'gallery') {
    if (!draft) return;
    saveDraft(draft);
    setAssetArchiveTarget({ assetId: draft.id, mode });
    if (!useAppStore.getState().imageGenPrompt.trim()) {
      setImageGenPrompt([draft.name, draft.summary].filter(Boolean).join(' - '));
    }
    setActiveModule('image_gen');
  }

  async function deleteSelectedArchive() {
    if (!selectedCard || !currentProject?.path || !window.orisonDesktop?.deleteAssetArchive) return;

    setDeletePending(true);
    setDeleteError(null);

    try {
      await window.orisonDesktop.deleteAssetArchive(currentProject.path, selectedCard.id);
      const nextCards = allCards.filter((card) => card.id !== selectedCard.id);
      updateField('asset_cards', nextCards);
      setAssetArchiveTarget(null);
      setSelectedId(nextCards.find((card) => isSupportedType(card.type))?.id ?? null);
      setShowDeleteConfirm(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletePending(false);
    }
  }

  if (archiveCards.length === 0 && legacyCards.length === 0) {
    return (
      <div className="creative-field-body">
        <p className="creative-empty">{t('creative.empty')}</p>
        <div className="asset-archive-create-row">
          {supportedAssetArchiveTypes.map((type) => (
            <button
              key={type}
              type="button"
              className="asset-archive-btn"
              onClick={() => createArchiveCard(type)}
            >
              {createArchiveLabel(type, archiveT)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="asset-archive-workspace">
      <aside className="asset-archive-sidebar">
        <div className="asset-archive-create-row">
          {supportedAssetArchiveTypes.map((type) => (
            <button
              key={type}
              type="button"
              className="asset-archive-btn"
              onClick={() => createArchiveCard(type)}
            >
              {createArchiveLabel(type, archiveT)}
            </button>
          ))}
        </div>

        <div className="asset-archive-list">
          {archiveCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`asset-archive-list-item${card.id === selectedCard?.id ? ' is-active' : ''}`}
              onClick={() => {
                setSelectedId(card.id);
                setDeleteError(null);
                setShowDeleteConfirm(false);
              }}
            >
              <span className="asset-archive-list-type">
                {assetTypeLabel(card.type, archiveT)} / {assetStatusLabel(card.status, archiveT)}
              </span>
              <strong>{card.name}</strong>
              <span>{card.summary || archiveT('noSummary')}</span>
            </button>
          ))}
        </div>

        {legacyCards.length > 0 ? (
          <div className="asset-archive-legacy">
            <h4>{archiveT('legacyTitle')}</h4>
            {legacyCards.map((card) => (
              <article key={card.id} className="asset-archive-legacy-item">
                <strong>{card.name}</strong>
                <span>{legacyTypeLabel(card.type, archiveT)}</span>
              </article>
            ))}
          </div>
        ) : null}
      </aside>

      {draft ? (
        <section className="asset-archive-detail">
          <header className="asset-archive-header">
            <div>
              <h3>{draft.name}</h3>
              <p className="asset-archive-path">
                {draft.archive?.path ?? buildArchivePath(draft.type as SupportedType, draft.name)}
              </p>
              <p className="asset-archive-meta">
                {assetTypeLabel(draft.type as SupportedType, archiveT)} / {assetStatusLabel(draft.status, archiveT)}
              </p>
            </div>
            <div className="asset-archive-actions">
              <button type="button" className="asset-archive-btn" onClick={() => launchImageGeneration('primary')}>
                {archiveT('generateImage')}
              </button>
              <button type="button" className="asset-archive-btn" onClick={() => launchImageGeneration('gallery')}>
                {archiveT('addGalleryImage')}
              </button>
              <button type="button" className="asset-archive-btn is-danger" onClick={() => setShowDeleteConfirm(true)}>
                {archiveT('deleteArchive')}
              </button>
              <button type="button" className="asset-archive-btn is-primary" onClick={() => saveDraft()}>
                {archiveT('saveDossier')}
              </button>
            </div>
          </header>

          {showDeleteConfirm ? (
            <section
              className="asset-archive-delete-confirm"
              role="alertdialog"
              aria-labelledby="asset-archive-delete-title"
            >
              <strong id="asset-archive-delete-title">{archiveT('deleteConfirmTitle')}</strong>
              <p>{archiveT('deleteConfirmBody')}</p>
              <div className="asset-archive-delete-actions">
                <button
                  type="button"
                  className="asset-archive-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletePending}
                >
                  {archiveT('cancelDelete')}
                </button>
                <button
                  type="button"
                  className="asset-archive-btn is-danger"
                  onClick={() => void deleteSelectedArchive()}
                  disabled={deletePending}
                >
                  {deletePending ? t('auth.pleaseWait') : archiveT('confirmDelete')}
                </button>
              </div>
            </section>
          ) : null}

          {deleteError ? (
            <p className="asset-archive-error" role="alert">
              {deleteError}
            </p>
          ) : null}

          <div className="asset-archive-grid">
            <LabeledInput
              label={archiveT('field.name')}
              value={draft.name}
              onChange={(value) => setDraft((current) => current ? normalizeCard({ ...current, name: value }) : current)}
            />
            <LabeledInput
              label={archiveT('field.summary')}
              value={draft.summary ?? ''}
              onChange={(value) => setDraft((current) => current ? normalizeCard({ ...current, summary: value }) : current)}
            />
            <LabeledInput
              label={archiveT('field.tags')}
              value={(draft.tags ?? []).join(', ')}
              onChange={(value) =>
                setDraft((current) => current ? { ...current, tags: splitCommaList(value) } : current)
              }
            />
            <LabeledInput
              label={archiveT('field.firstAppearance')}
              value={draft.firstAppearance ?? ''}
              onChange={(value) => setDraft((current) => current ? { ...current, firstAppearance: value } : current)}
            />
            <TypeSpecificFields draft={draft} setDraft={setDraft} translate={archiveT} />
          </div>

          <section className="asset-archive-gallery">
            <h4>{archiveT('galleryTitle')}</h4>
            {draft.visuals?.gallery.length ? (
              <div className="asset-archive-gallery-list">
                {draft.visuals.gallery.map((image) => (
                  <article key={image.id} className="asset-archive-gallery-item">
                    <span className="asset-archive-gallery-kind">{imageKindLabel(image.kind, archiveT)}</span>
                    <span>{image.path}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="creative-field-secondary">{archiveT('noImages')}</p>
            )}
          </section>
        </section>
      ) : (
        <p className="creative-empty">{t('creative.empty')}</p>
      )}
    </div>
  );
}

function TypeSpecificFields({
  draft,
  setDraft,
  translate,
}: {
  draft: AssetCard;
  setDraft: Dispatch<SetStateAction<AssetCard | null>>;
  translate: (key: string) => string;
}) {
  if (!isSupportedType(draft.type)) return null;

  const details = ensureDetails(draft);

  if (draft.type === 'character') {
    return (
      <>
        <LabeledInput
          label={translate('field.role')}
          value={readNested(details, 'profile.role')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'profile.role', value) : current)}
        />
        <LabeledInput
          label={translate('field.occupation')}
          value={readNested(details, 'profile.occupation')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'profile.occupation', value) : current)}
        />
        <LabeledInput
          label={translate('field.personality')}
          value={readNested(details, 'persona.personality')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'persona.personality', value) : current)}
        />
        <LabeledInput
          label={translate('field.motivation')}
          value={readNested(details, 'persona.motivation')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'persona.motivation', value) : current)}
        />
      </>
    );
  }

  if (draft.type === 'location') {
    return (
      <>
        <LabeledInput
          label={translate('field.category')}
          value={readNested(details, 'profile.category')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'profile.category', value) : current)}
        />
        <LabeledInput
          label={translate('field.region')}
          value={readNested(details, 'profile.region')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'profile.region', value) : current)}
        />
        <LabeledInput
          label={translate('field.atmosphere')}
          value={readNested(details, 'setting.atmosphere')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'setting.atmosphere', value) : current)}
        />
        <LabeledInput
          label={translate('field.rules')}
          value={readNested(details, 'setting.rules')}
          onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'setting.rules', value) : current)}
        />
      </>
    );
  }

  return (
    <>
      <LabeledInput
        label={translate('field.category')}
        value={readNested(details, 'profile.category')}
        onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'profile.category', value) : current)}
      />
      <LabeledInput
        label={translate('field.owner')}
        value={readNested(details, 'profile.owner')}
        onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'profile.owner', value) : current)}
      />
      <LabeledInput
        label={translate('field.function')}
        value={readNested(details, 'story.function')}
        onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'story.function', value) : current)}
      />
      <LabeledInput
        label={translate('field.risk')}
        value={readNested(details, 'story.risk')}
        onChange={(value) => setDraft((current) => current ? writeNestedDraft(current, 'story.risk', value) : current)}
      />
    </>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="asset-archive-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function normalizeCard(card: AssetCard): AssetCard {
  if (!isSupportedType(card.type)) return card;

  const archivePath = card.archive?.path ?? buildArchivePath(card.type, card.name);
  const slug = card.archive?.slug ?? archivePath.split('/').pop()?.replace(/\.yaml$/, '') ?? slugify(card.name);
  const visuals = card.visuals
    ? {
        primaryImage: card.visuals.primaryImage,
        gallery: [...card.visuals.gallery],
      }
    : {
        primaryImage: undefined,
        gallery: [],
      };
  const sourceRefs = new Set(card.sourceRefs ?? []);
  sourceRefs.add(archivePath);
  if (visuals.primaryImage) sourceRefs.add(visuals.primaryImage);

  return {
    ...card,
    archive: {
      path: archivePath,
      slug,
      schemaVersion: 1,
    },
    visuals,
    sourceRefs: [...sourceRefs],
    locked: card.locked ?? false,
  };
}

function buildArchivePath(type: SupportedType, name: string) {
  return `assets/${type}s/${slugify(name || type)}.yaml`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

function splitCommaList(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function cloneCard(card: AssetCard) {
  return structuredClone(card);
}

function isSupportedType(type: string): type is SupportedType {
  return SUPPORTED_SET.has(type);
}

function ensureDetails(card: AssetCard) {
  return (card.details && typeof card.details === 'object' && !Array.isArray(card.details)
    ? card.details
    : {}) as Record<string, unknown>;
}

function readNested(details: Record<string, unknown>, keyPath: string) {
  return (keyPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return '';
    return (current as Record<string, unknown>)[key];
  }, details) as string) ?? '';
}

function writeNestedDraft(card: AssetCard, keyPath: string, value: string): AssetCard {
  const details = structuredClone(ensureDetails(card));
  let cursor: Record<string, unknown> = details;
  const keys = keyPath.split('.');
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    const next = cursor[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  });
  return normalizeCard({ ...card, details });
}

function createArchiveLabel(type: SupportedType, translate: (key: string) => string) {
  const key = type === 'character'
    ? 'createCharacter'
    : type === 'location'
      ? 'createLocation'
      : 'createProp';
  return translate(key);
}

function defaultArchiveName(type: SupportedType, translate: (key: string) => string) {
  const key = type === 'character'
    ? 'newCharacterName'
    : type === 'location'
      ? 'newLocationName'
      : 'newPropName';
  return translate(key);
}

function assetTypeLabel(type: SupportedType, translate: (key: string) => string) {
  return translate(`type.${type}`);
}

function assetStatusLabel(status: string, translate: (key: string) => string) {
  const key = `status.${status}`;
  const translated = translate(key);
  return translated === key ? status : translated;
}

function imageKindLabel(kind: string, translate: (key: string) => string) {
  const key = `imageKind.${kind}`;
  const translated = translate(key);
  return translated === key ? kind : translated;
}

function legacyTypeLabel(type: string, translate: (key: string) => string) {
  if (isSupportedType(type)) {
    return assetTypeLabel(type, translate);
  }
  return type;
}

function assetArchiveMessage(
  locale: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  key: string,
) {
  if (locale === 'zh-CN' && key in ZH_ARCHIVE_COPY) {
    return ZH_ARCHIVE_COPY[key];
  }

  const translated = t(`creative.assetArchive.${key}`);
  return translated === `creative.assetArchive.${key}` ? key : translated;
}
