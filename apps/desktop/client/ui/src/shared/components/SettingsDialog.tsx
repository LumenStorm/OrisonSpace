import { useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { GeneralSettingsPage } from './settings/GeneralSettingsPage';
import { AboutSettingsPage } from './settings/AboutSettingsPage';
import { ModelSettingsPage } from '../../features/model-settings/ModelSettingsPage';
import { useToastStore } from '../store/toastStore';

type Props = { onClose: () => void };
type SettingsPageId = 'general' | 'model' | 'about';

const SETTINGS_PAGES: Array<{ id: SettingsPageId; icon: string; labelKey: string }> = [
  { id: 'general', icon: 'tune', labelKey: 'settings.general' },
  { id: 'model', icon: 'smart_toy', labelKey: 'settings.modelConfig' },
  { id: 'about', icon: 'info', labelKey: 'settings.about' },
];

export function SettingsDialog({ onClose }: Props) {
  const {
    resolvedLocale, theme, setTheme, locale, setLocale,
    modelConfig, setModelConfig,
    readingFontFamily, setReadingFontFamily,
    readingFontWeight, setReadingFontWeight,
    readingFontScale, setReadingFontScale,
    autoCheckUpdates, setAutoCheckUpdates,
    appVersion, checkForUpdate,
  } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    theme: s.theme, setTheme: s.setTheme,
    locale: s.locale, setLocale: s.setLocale,
    modelConfig: s.modelConfig, setModelConfig: s.setModelConfig,
    readingFontFamily: s.readingFontFamily, setReadingFontFamily: s.setReadingFontFamily,
    readingFontWeight: s.readingFontWeight, setReadingFontWeight: s.setReadingFontWeight,
    readingFontScale: s.readingFontScale, setReadingFontScale: s.setReadingFontScale,
    autoCheckUpdates: s.autoCheckUpdates, setAutoCheckUpdates: s.setAutoCheckUpdates,
    appVersion: s.appVersion, checkForUpdate: s.checkForUpdate,
  })));

  const { t } = useI18n(resolvedLocale);
  const showToast = useToastStore((s) => s.showToast);
  const [activePage, setActivePage] = useState<SettingsPageId>('general');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);

  return (
    <div className="topbar-new-dialog-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="settings-dialog" ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
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
                readingFontFamily={readingFontFamily}
                setReadingFontFamily={setReadingFontFamily}
                readingFontWeight={readingFontWeight}
                setReadingFontWeight={setReadingFontWeight}
                readingFontScale={readingFontScale}
                setReadingFontScale={setReadingFontScale}
                autoCheckUpdates={autoCheckUpdates}
                setAutoCheckUpdates={setAutoCheckUpdates}
                appVersion={appVersion}
                onCheckForUpdate={() => { void checkForUpdate(); }}
              />
            ) : activePage === 'model' ? (
              <ModelSettingsPage
                t={t}
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
              />
            ) : (
              <AboutSettingsPage
                t={t}
                appVersion={appVersion}
                onCopied={() => showToast(t('settings.aboutCopied'), 'success')}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
