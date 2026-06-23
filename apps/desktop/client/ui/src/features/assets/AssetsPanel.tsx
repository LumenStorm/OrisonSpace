import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useConfirmStore } from '../../shared/store/confirmStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AssetRecord } from '@orison/shared-contracts';
import {
  readAssetsDirectory, listAssets, upsertAsset, updateAsset,
  deleteAsset, deleteEntry, pathExists, saveBase64Image, showItemInFolder,
  importAssets,
} from '../../shared/api/assets';

type MergedAsset = AssetRecord & { absolutePath: string };
type SortMode = 'name' | 'time';

export function AssetsPanel() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const projectPath = useAppStore((s) => s.currentProject?.path);
  const projectId = useAppStore((s) => s.currentProject?.projectId);
  const requestConfirm = useConfirmStore((s) => s.requestConfirm);
  const { t } = useI18n(resolvedLocale);
  const [assets, setAssets] = useState<MergedAsset[]>([]);
  const [selected, setSelected] = useState<MergedAsset | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [search, setSearch] = useState('');
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [dragging, setDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const assetsDir = projectPath ? `${projectPath}/assets/images` : '';

  const loadAssets = useCallback(async () => {
    if (!assetsDir) return;
    try {
      const entries = await readAssetsDirectory(assetsDir);
      const dbRecords = projectId ? await listAssets(projectId) : [];
      const dbMap = new Map(dbRecords.map((r) => [r.relativePath, r]));

      // Flatten nested entries: agent-generated images land in subdirectories
      // (assets/images/generation, .../edits), so a flat top-level scan would
      // miss them. `e.path` is relative to assetsDir with a leading '/'.
      type FlatImage = { name: string; rel: string };
      const flat: FlatImage[] = [];
      const walk = (items: Array<{ name: string; isDir: boolean; path?: string; children?: any[] }>) => {
        for (const e of items) {
          if (e.isDir) {
            if (Array.isArray(e.children)) walk(e.children);
            continue;
          }
          if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(e.name)) continue;
          const sub = (e.path ?? `/${e.name}`).replace(/^\//, '');
          flat.push({ name: e.name, rel: sub });
        }
      };
      walk(entries as any);

      const images = flat.map(({ name, rel }) => {
        const relativePath = `assets/images/${rel}`;
        const absolutePath = `${assetsDir}/${rel}`.replace(/\\/g, '/');
        const existing = dbMap.get(relativePath);
        if (existing) {
          return { ...existing, absolutePath };
        }
        const newRecord: MergedAsset = {
          assetId: crypto.randomUUID(),
          projectId: projectId ?? '',
          assetType: 'image',
          assetName: name.replace(/\.[^.]+$/, ''),
          assetGroup: '',
          assetStatus: 'active',
          relativePath,
          version: 1,
          updatedAt: new Date().toISOString(),
          absolutePath,
        };
        if (projectId) {
          upsertAsset({
            assetId: newRecord.assetId,
            projectId,
            assetType: 'image',
            assetName: newRecord.assetName,
            assetGroup: '',
            relativePath,
          });
        }
        return newRecord;
      });
      setAssets(images);
    } catch {
      setAssets([]);
    }
  }, [assetsDir, projectId]);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  // Refresh when an image is created/promoted elsewhere (agent generation, the
  // Image Gen "add to assets" action, external file changes). Without this the
  // panel only showed new images after a manual refresh or remount.
  useEffect(() => {
    const handler = (e: Event) => {
      const { type } = (e as CustomEvent).detail ?? {};
      if (type === 'image:created' || type === 'file:changed') void loadAssets();
    };
    window.addEventListener('orison:tool-event', handler);
    return () => window.removeEventListener('orison:tool-event', handler);
  }, [loadAssets]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    let result = assets;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.assetName.toLowerCase().includes(q) || a.assetGroup.toLowerCase().includes(q));
    }
    if (activeGroups.size > 0) {
      result = result.filter((a) => activeGroups.has(a.assetGroup || ''));
    }
    if (sortMode === 'time') {
      result = [...result].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } else {
      result = [...result].sort((a, b) => a.assetName.localeCompare(b.assetName));
    }
    return result;
  }, [assets, search, activeGroups, sortMode]);

  // Group assets
  const grouped = useMemo(() => {
    const map = new Map<string, MergedAsset[]>();
    for (const a of filtered) {
      const g = a.assetGroup || '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  // Existing group names for dropdown (always include defaults)
  const groupOptions = useMemo(() => {
    const defaults = [
      t('assets.groupCharacter') || '角色',
      t('assets.groupScene') || '场景',
      t('assets.groupProp') || '道具',
    ];
    const names = new Set([...defaults, ...assets.map((a) => a.assetGroup).filter(Boolean)]);
    return [...names].sort();
  }, [assets, t]);

  const handleSelect = (asset: MergedAsset) => {
    setSelected(asset);
    setEditName(asset.assetName);
    setEditGroup(asset.assetGroup);
    setEditSummary(asset.summary ?? '');
  };

  const handleShowInFolder = () => {
    if (selected) showItemInFolder(selected.absolutePath);
  };

  const handleDelete = async () => {
    if (!selected) return;
    const confirmed = await requestConfirm({
      title: t('assets.deleteTitle') || '删除资产',
      message: t('assets.deleteConfirm') || `确定要删除 "${selected.assetName}" 吗？此操作不可撤销。`,
      variant: 'danger',
      confirmLabel: t('common.delete') || '删除',
    });
    if (!confirmed) return;
    await deleteEntry(selected.absolutePath);
    if (projectId) await deleteAsset(projectId, selected.assetId);
    setSelected(null);
    void loadAssets();
  };

  const handleSave = async () => {
    if (!selected) return;
    if (projectId) {
      await updateAsset(projectId, selected.assetId, {
        assetName: editName,
        assetGroup: editGroup,
        summary: editSummary,
      });
    }
    setSelected(null);
    void loadAssets();
  };

  const toggleGroupFilter = (group: string) => {
    setActiveGroups((prev) => {
      if (prev.has(group)) return new Set();
      return new Set([group]);
    });
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!assetsDir) return;
    const files = Array.from(e.dataTransfer.files).filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name));
    for (const file of files) {
      const destPath = `${assetsDir}/${file.name}`;
      const exists = await pathExists(destPath);
      if (!exists) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          if (base64 && projectPath) {
            const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
            const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
            await saveBase64Image(projectPath, {
              b64Json: base64,
              mimeType: mimeMap[ext] || 'image/png',
              directory: 'assets/images',
              fileName: file.name,
            });
            void loadAssets();
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }, [assetsDir, projectPath, loadAssets]);

  const handleImport = useCallback(async () => {
    if (!projectPath) return;
    try {
      const imported = await importAssets(projectPath, projectId ?? '');
      if (imported.length > 0) void loadAssets();
    } catch {
      // Import is best-effort; a failed picker simply changes nothing.
    }
  }, [projectPath, projectId, loadAssets]);

  return (
    <div
      className={`assets-panel${dragging ? ' assets-panel--dragging' : ''}`}
      ref={dropRef}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <header className="assets-panel-header">
        <h2 className="assets-panel-title">{t('nav.assets') || 'Assets'}</h2>
        <div className="assets-panel-header-actions">
          <button type="button" className="assets-panel-import" onClick={() => void handleImport()} title={t('assets.import') || 'Import'}>
            <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
          </button>
          <button type="button" className="assets-panel-refresh" onClick={loadAssets} title={t('assets.refresh') || 'Refresh'}>
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
          </button>
        </div>
      </header>

      <div className="assets-toolbar">
        <input
          className="assets-search"
          type="search"
          placeholder={t('assets.search') || 'Search...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className={`assets-sort-btn${sortMode === 'time' ? ' is-active' : ''}`} onClick={() => setSortMode(sortMode === 'name' ? 'time' : 'name')} title={sortMode === 'name' ? 'Sort by time' : 'Sort by name'}>
          <span className="material-symbols-outlined">{sortMode === 'time' ? 'schedule' : 'sort_by_alpha'}</span>
        </button>
      </div>

      {groupOptions.length > 0 && (
        <div className="assets-filter-chips">
          {groupOptions.map((g) => (
            <button
              key={g}
              type="button"
              className={`assets-chip${activeGroups.has(g) ? ' is-active' : ''}`}
              onClick={() => toggleGroupFilter(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {assets.length === 0 ? (
        <div className="assets-panel-empty">
          <span className="material-symbols-outlined">perm_media</span>
          <p>{t('assets.empty') || 'No assets yet'}</p>
          <p className="assets-panel-empty-hint">{t('assets.dropHint') || 'Drag images here, or import from your files.'}</p>
          <button type="button" className="assets-panel-empty-import" onClick={() => void handleImport()}>
            <span className="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
            <span>{t('assets.import') || 'Import'}</span>
          </button>
        </div>
      ) : (
        <div className="assets-panel-groups">
          {grouped.map(([group, items]) => (
            <section key={group || '__ungrouped'} className="assets-group">
              <h3 className="assets-group-title">
                {group || (t('assets.ungrouped') || 'Ungrouped')}
                <span className="assets-group-count">{items.length}</span>
              </h3>
              <div className="assets-panel-grid">
                {items.map((asset) => (
                  <button
                    key={asset.assetId}
                    type="button"
                    className="assets-panel-card"
                    onClick={() => handleSelect(asset)}
                  >
                    <img src={`orison-file:///${asset.absolutePath}`} alt={asset.assetName} loading="lazy" />
                    <span className="assets-panel-card-name">{asset.assetName}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <div className="assets-detail-overlay" onClick={() => setSelected(null)}>
          <div className="assets-detail-dialog" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="assets-detail-close" onClick={() => setSelected(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="assets-detail-image">
              <img src={`orison-file:///${selected.absolutePath}`} alt={selected.assetName} />
            </div>
            <div className="assets-detail-info">
              <label className="assets-detail-field">
                <span className="assets-detail-label">{t('assets.name') || 'Name'}</span>
                <input
                  className="assets-detail-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label className="assets-detail-field">
                <span className="assets-detail-label">{t('assets.group') || 'Group'}</span>
                <input
                  className="assets-detail-input"
                  list="asset-group-options"
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  placeholder={t('assets.groupPlaceholder') || 'e.g. Characters, Backgrounds...'}
                />
                <datalist id="asset-group-options">
                  {groupOptions.map((g) => <option key={g} value={g} />)}
                </datalist>
              </label>
              <label className="assets-detail-field">
                <span className="assets-detail-label">{t('assets.description') || 'Description'}</span>
                <textarea
                  className="assets-detail-textarea"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={3}
                  placeholder={t('assets.descriptionPlaceholder') || 'Brief description...'}
                />
              </label>
              <p className="assets-detail-path">{selected.relativePath}</p>
            </div>
            <div className="assets-detail-actions">
              <button type="button" className="assets-detail-action assets-detail-action--primary" onClick={() => void handleSave()}>
                <span className="material-symbols-outlined">check</span>
                <span>{t('assets.save') || 'Save'}</span>
              </button>
              <button type="button" className="assets-detail-action" onClick={handleShowInFolder}>
                <span className="material-symbols-outlined">folder_open</span>
                <span>{t('assets.showInFolder') || 'Show in Folder'}</span>
              </button>
              <button type="button" className="assets-detail-action assets-detail-action--danger" onClick={() => void handleDelete()}>
                <span className="material-symbols-outlined">delete</span>
                <span>{t('assets.delete') || 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
