import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { GeneralSettingsPage } from './settings/GeneralSettingsPage';
import { ModelSettingsPage } from './settings/ModelSettingsPage';

type Props = { onClose: () => void };
type SettingsPageId = 'general' | 'model';

const SETTINGS_PAGES: Array<{ id: SettingsPageId; icon: string; labelKey: string }> = [
  { id: 'general', icon: 'tune', labelKey: 'settings.general' },
  { id: 'model', icon: 'smart_toy', labelKey: 'settings.modelConfig' },
];

export function SettingsDialog({ onClose }: Props) {
  const {
    resolvedLocale, theme, setTheme, locale, setLocale,
    modelConfig, setModelConfig,
    autoApplyPatches, setAutoApplyPatches,
    updateManifestUrl, setUpdateManifestUrl,
  } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    theme: s.theme, setTheme: s.setTheme,
    locale: s.locale, setLocale: s.setLocale,
    modelConfig: s.modelConfig, setModelConfig: s.setModelConfig,
    autoApplyPatches: s.autoApplyPatches, setAutoApplyPatches: s.setAutoApplyPatches,
    updateManifestUrl: s.updateManifestUrl, setUpdateManifestUrl: s.setUpdateManifestUrl,
  })));

  const { t } = useI18n(resolvedLocale);
  const [activePage, setActivePage] = useState<SettingsPageId>('general');

  return (
    <div className="topbar-new-dialog-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{t('nav.settings')}</h2>
          <button type="button" className="settings-dialog-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-dialog-body settings-dialog-body-with-nav">
          <nav className="settings-dialog-nav" aria-label={t('nav.settings')}>
            {SETTINGS_PAGES.map((page) => (
              <button
                key={page.id}
                type="button"
                className={`settings-dialog-nav-item${activePage === page.id ? ' is-active' : ''}`}
                onClick={() => setActivePage(page.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{page.icon}</span>
                <span>{t(page.labelKey)}</span>
              </button>
            ))}
          </nav>

          <section className="settings-dialog-page">
            {activePage === 'general' ? (
              <GeneralSettingsPage
                t={t}
                theme={theme}
                setTheme={setTheme}
                locale={locale}
                setLocale={setLocale}
                autoApplyPatches={autoApplyPatches}
                setAutoApplyPatches={setAutoApplyPatches}
                updateManifestUrl={updateManifestUrl}
                setUpdateManifestUrl={setUpdateManifestUrl}
              />
            ) : (
              <ModelSettingsPage
                t={t}
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
