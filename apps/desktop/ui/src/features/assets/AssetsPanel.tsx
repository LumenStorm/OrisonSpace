import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import type { AssetRecord } from '@orison/shared-contracts';

type MergedAsset = AssetRecord & { absolutePath: string };

export function AssetsPanel() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const projectPath = useAppStore((s) => s.currentProject?.path);
  const projectId = useAppStore((s) => s.currentProject?.projectId);
  const { t } = useI18n(resolvedLocale);
  const [assets, setAssets] = useState<MergedAsset[]>([]);
  const [selected, setSelected] = useState<MergedAsset | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editSummary, setEditSummary] = useState('');

  const assetsDir = projectPath ? `${projectPath}/assets/images` : '';

  const loadAssets = useCallback(async () => {
    if (!assetsDir || !window.orisonDesktop?.readDirectory) return;
    try {
      const entries = await window.orisonDesktop.readDirectory(assetsDir);
      const dbRecords = projectId ? await window.orisonDesktop.listAssets(projectId) : [];
      const dbMap = new Map(dbRecords.map((r) => [r.relativePath, r]));
      const images = entries
        .filter((e) => !e.isDir && /\.(png|jpe?g|webp|gif|svg)$/i.test(e.name))
        .map((e) => {
          const relativePath = `assets/images/${e.name}`;
          const absolutePath = `${assetsDir}/${e.name}`.replace(/\\/g, '/');
          const existing = dbMap.get(relativePath);
          if (existing) {
            return { ...existing, absolutePath };
          }
          // Auto-register new file in DB (if projectId available)
          const newRecord: MergedAsset = {
            assetId: crypto.randomUUID(),
            projectId: projectId ?? '',
            assetType: 'image',
            assetName: e.name.replace(/\.[^.]+$/, ''),
            assetGroup: '',
            assetStatus: 'active',
            relativePath,
            version: 1,
            updatedAt: new Date().toISOString(),
            absolutePath,
          };
          if (projectId) {
            window.orisonDesktop.upsertAsset({
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

  // Group assets
  const grouped = useMemo(() => {
    const map = new Map<string, MergedAsset[]>();
    for (const a of assets) {
      const g = a.assetGroup || '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(a);
    }
    // Sort: named groups first alphabetically, then ungrouped
    return [...map.entries()].sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    });
  }, [assets]);

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
    if (selected) window.orisonDesktop?.showItemInFolder(selected.absolutePath);
  };

  const handleDelete = async () => {
    if (!selected) return;
    await window.orisonDesktop?.deleteEntry(selected.absolutePath);
    if (projectId) await window.orisonDesktop?.deleteAsset(projectId, selected.assetId);
    setSelected(null);
    void loadAssets();
  };

  const handleSave = async () => {
    if (!selected) return;
    if (projectId) {
      await window.orisonDesktop?.updateAsset(projectId, selected.assetId, {
        assetName: editName,
        assetGroup: editGroup,
        summary: editSummary,
      });
    }
    setSelected(null);
    void loadAssets();
  };

  return (
    <div className="assets-panel">
      <header className="assets-panel-header">
        <h2 className="assets-panel-title">{t('nav.assets') || 'Assets'}</h2>
        <button type="button" className="assets-panel-refresh" onClick={loadAssets}>
          <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
        </button>
      </header>

      {assets.length === 0 ? (
        <div className="assets-panel-empty">
          <span className="material-symbols-outlined">perm_media</span>
          <p>{t('assets.empty') || 'No assets yet'}</p>
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
