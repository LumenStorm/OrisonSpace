import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { GeneralSettingsPage } from './settings/GeneralSettingsPage';
import { AppearanceSettingsPage } from './settings/AppearanceSettingsPage';
import { WritingSettingsPage } from './settings/WritingSettingsPage';
import { AgentSettingsPage } from './settings/AgentSettingsPage';
import { AboutSettingsPage } from './settings/AboutSettingsPage';
import { ModelSettingsPage } from '../../features/model-settings/ModelSettingsPage';
import { useToastStore } from '../store/toastStore';

type Props = { onClose: () => void };
type SettingsPageId = 'general' | 'appearance' | 'writing' | 'model' | 'agent' | 'about';

const SETTINGS_PAGES: Array<{ id: SettingsPageId; icon: string; labelKey: string }> = [
  { id: 'general', icon: 'tune', labelKey: 'settings.general' },
  { id: 'appearance', icon: 'palette', labelKey: 'settings.appearance' },
  { id: 'writing', icon: 'edit_note', labelKey: 'settings.writing' },
  { id: 'model', icon: 'hub', labelKey: 'settings.modelConfig' },
  { id: 'agent', icon: 'smart_toy', labelKey: 'settings.agent' },
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
    // Appearance
    uiDensity, setUiDensity,
    sidebarWidth, setSidebarWidth,
    editorLineHeight, setEditorLineHeight,
    // Writing
    autoSaveEnabled, setAutoSaveEnabled,
    autoSaveInterval, setAutoSaveInterval,
    chapterPrefix, setChapterPrefix,
    paragraphIndent, setParagraphIndent,
    showWordCount, setShowWordCount,
    // Agent
    autoApplyPatches, setAutoApplyPatches,
    agentSessionRetention, setAgentSessionRetention,
    agentDefaultModel, setAgentDefaultModel,
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
    // Appearance
    uiDensity: s.uiDensity, setUiDensity: s.setUiDensity,
    sidebarWidth: s.sidebarWidth, setSidebarWidth: s.setSidebarWidth,
    editorLineHeight: s.editorLineHeight, setEditorLineHeight: s.setEditorLineHeight,
    // Writing
    autoSaveEnabled: s.autoSaveEnabled, setAutoSaveEnabled: s.setAutoSaveEnabled,
    autoSaveInterval: s.autoSaveInterval, setAutoSaveInterval: s.setAutoSaveInterval,
    chapterPrefix: s.chapterPrefix, setChapterPrefix: s.setChapterPrefix,
    paragraphIndent: s.paragraphIndent, setParagraphIndent: s.setParagraphIndent,
    showWordCount: s.showWordCount, setShowWordCount: s.setShowWordCount,
    // Agent
    autoApplyPatches: s.autoApplyPatches, setAutoApplyPatches: s.setAutoApplyPatches,
    agentSessionRetention: s.agentSessionRetention, setAgentSessionRetention: s.setAgentSessionRetention,
    agentDefaultModel: s.agentDefaultModel, setAgentDefaultModel: s.setAgentDefaultModel,
  })));

  const { t } = useI18n(resolvedLocale);
  const showToast = useToastStore((s) => s.showToast);
  const [activePage, setActivePage] = useState<SettingsPageId>('general');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(dialogRef, onClose);

  const modelOptions = useMemo(() => {
    return modelConfig.keys.map((k) => ({
      value: k.id ?? k.name ?? '',
      label: k.name ?? k.id ?? 'Unnamed',
    }));
  }, [modelConfig.keys]);

  const renderPage = () => {
    switch (activePage) {
      case 'general':
        return (
          <GeneralSettingsPage
            t={t}
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
        );
      case 'appearance':
        return (
          <AppearanceSettingsPage
            t={t}
            theme={theme}
            setTheme={setTheme}
            uiDensity={uiDensity}
            setUiDensity={setUiDensity}
            sidebarWidth={sidebarWidth}
            setSidebarWidth={setSidebarWidth}
            editorLineHeight={editorLineHeight}
            setEditorLineHeight={setEditorLineHeight}
          />
        );
      case 'writing':
        return (
          <WritingSettingsPage
            t={t}
            autoSaveEnabled={autoSaveEnabled}
            setAutoSaveEnabled={setAutoSaveEnabled}
            autoSaveInterval={autoSaveInterval}
            setAutoSaveInterval={setAutoSaveInterval}
            chapterPrefix={chapterPrefix}
            setChapterPrefix={setChapterPrefix}
            paragraphIndent={paragraphIndent}
            setParagraphIndent={setParagraphIndent}
            showWordCount={showWordCount}
            setShowWordCount={setShowWordCount}
          />
        );
      case 'model':
        return (
          <ModelSettingsPage
            t={t}
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
          />
        );
      case 'agent':
        return (
          <AgentSettingsPage
            t={t}
            autoApplyPatches={autoApplyPatches}
            setAutoApplyPatches={setAutoApplyPatches}
            agentSessionRetention={agentSessionRetention}
            setAgentSessionRetention={setAgentSessionRetention}
            agentDefaultModel={agentDefaultModel}
            setAgentDefaultModel={setAgentDefaultModel}
            modelOptions={modelOptions}
          />
        );
      case 'about':
        return (
          <AboutSettingsPage
            t={t}
            appVersion={appVersion}
            onCopied={() => showToast(t('settings.aboutCopied'), 'success')}
          />
        );
    }
  };

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
            {renderPage()}
          </section>
        </div>
      </div>
    </div>
  );
}
