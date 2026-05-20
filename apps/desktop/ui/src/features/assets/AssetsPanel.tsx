import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type AssetEntry = { name: string; path: string };

export function AssetsPanel() {
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const projectPath = useAppStore((s) => s.currentProject?.path);
  const { t } = useI18n(resolvedLocale);
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [previewing, setPreviewing] = useState<AssetEntry | null>(null);

  const loadAssets = useCallback(async () => {
    if (!projectPath || !window.orisonDesktop?.readDirectory) return;
    try {
      const entries = await window.orisonDesktop.readDirectory(`${projectPath}/assets/images`);
      const images = entries
        .filter((e) => !e.isDir && /\.(png|jpe?g|webp|gif|svg)$/i.test(e.name))
        .map((e) => ({ name: e.name, path: e.path }));
      setAssets(images);
    } catch {
      setAssets([]);
    }
  }, [projectPath]);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

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
        <div className="assets-panel-grid">
          {assets.map((asset) => (
            <button
              key={asset.path}
              type="button"
              className="assets-panel-card"
              onClick={() => setPreviewing(asset)}
            >
              <img src={`orison-file://${asset.path}`} alt={asset.name} loading="lazy" />
              <span className="assets-panel-card-name">{asset.name}</span>
            </button>
          ))}
        </div>
      )}

      {previewing && (
        <div className="assets-panel-preview-overlay" onClick={() => setPreviewing(null)}>
          <div className="assets-panel-preview" onClick={(e) => e.stopPropagation()}>
            <img src={`orison-file://${previewing.path}`} alt={previewing.name} />
            <button type="button" className="assets-panel-preview-close" onClick={() => setPreviewing(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
