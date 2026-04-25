import { useCallback, useEffect, useState } from 'react';
import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';

type NavItem = { key: WorkspaceModule; icon: string; i18nKey: string };

const novelNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'creative', icon: 'palette', i18nKey: 'nav.creative' },
  { key: 'novel', icon: 'menu_book', i18nKey: 'nav.novel' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

const scriptNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'creative', icon: 'palette', i18nKey: 'nav.creative' },
  { key: 'script', icon: 'description', i18nKey: 'nav.script' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

export function SideNav() {
  const {
    activeModule, setActiveModule,
    currentProject, resolvedLocale,
    theme, setTheme,
    locale, setLocale,
    user, logout,
    modelConfig, setModelConfig, loadModelConfig,
    autoApplyPatches, setAutoApplyPatches,
  } = useAppStore(useShallow((s) => ({
    activeModule: s.activeModule,
    setActiveModule: s.setActiveModule,
    currentProject: s.currentProject,
    resolvedLocale: s.resolvedLocale,
    theme: s.theme,
    setTheme: s.setTheme,
    locale: s.locale,
    setLocale: s.setLocale,
    user: s.user,
    logout: s.logout,
    modelConfig: s.modelConfig,
    setModelConfig: s.setModelConfig,
    loadModelConfig: s.loadModelConfig,
    autoApplyPatches: s.autoApplyPatches,
    setAutoApplyPatches: s.setAutoApplyPatches,
  })));

  const { t } = useI18n(resolvedLocale);
  const navItems = currentProject?.type === 'novel' ? novelNavItems : scriptNavItems;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => { loadModelConfig(); }, [loadModelConfig]);

  const handleModelConfigChange = useCallback((field: 'apiKey' | 'baseUrl' | 'model', value: string) => {
    const next = { ...modelConfig, [field]: value };
    setModelConfig(next);
  }, [modelConfig, setModelConfig]);

  const handleToggleSettings = useCallback(() => {
    setShowSettings((v) => !v);
    setShowAccount(false);
  }, []);

  const handleToggleAccount = useCallback(() => {
    setShowAccount((v) => !v);
    setShowSettings(false);
  }, []);

  const handleModuleClick = useCallback(
    (key: WorkspaceModule) => setActiveModule(key),
    [setActiveModule],
  );

  return (
    <nav className="workspace-sidebar" aria-label="Module Navigation">
      <div className="workspace-sidebarHeader">
        <h2 className="workspace-sidebarTitle">{t('nav.project')}</h2>
        <p className="workspace-sidebarMeta">AI Feature Film v1</p>
      </div>
      <div className="workspace-tree">
        {navItems.map((item) => {
          const active = item.key === activeModule;
          return (
            <button
              key={item.key}
              type="button"
              className={`workspace-treeItem${active ? ' workspace-treeItemActive' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => handleModuleClick(item.key)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              <span>{t(item.i18nKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-bottom">
        {showSettings && (
          <div className="sidebar-settings-panel">
            <div className="sidebar-settings-row">
              <span className="sidebar-settings-label">{t('settings.theme')}</span>
              <div className="sidebar-settings-options">
                {(['system', 'light', 'dark'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`sidebar-settings-option${theme === v ? ' is-active' : ''}`}
                    onClick={() => setTheme(v)}
                  >
                    {t(`settings.theme${v[0].toUpperCase() + v.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="sidebar-settings-row">
              <span className="sidebar-settings-label">{t('settings.language')}</span>
              <div className="sidebar-settings-options">
                {(['system', 'zh-CN', 'en-US'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`sidebar-settings-option${locale === v ? ' is-active' : ''}`}
                    onClick={() => setLocale(v)}
                  >
                    {v === 'system' ? t('settings.languageSystem') : v}
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-settings-divider" />

            <div className="sidebar-settings-row">
              <span className="sidebar-settings-label">
                {t('settings.model')}
                <span className={`sidebar-config-dot${modelConfig.apiKey ? ' is-configured' : ''}`} />
              </span>
              <div className="sidebar-settings-input-row">
                <label className="sidebar-settings-input-label">{t('settings.apiKey')}</label>
                <div className="sidebar-settings-input-wrap">
                  <input
                    className="sidebar-settings-input"
                    type={showApiKey ? 'text' : 'password'}
                    value={modelConfig.apiKey}
                    placeholder={t('settings.apiKeyPlaceholder')}
                    onChange={(e) => handleModelConfigChange('apiKey', e.target.value)}
                  />
                  <button
                    type="button"
                    className="sidebar-settings-input-toggle"
                    onClick={() => setShowApiKey((v) => !v)}
                    aria-label={showApiKey ? t('settings.hideKey') : t('settings.showKey')}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {showApiKey ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
              <div className="sidebar-settings-input-row">
                <label className="sidebar-settings-input-label">{t('settings.baseUrl')}</label>
                <input
                  className="sidebar-settings-input"
                  type="text"
                  value={modelConfig.baseUrl}
                  placeholder={t('settings.baseUrlPlaceholder')}
                  onChange={(e) => handleModelConfigChange('baseUrl', e.target.value)}
                />
              </div>
              <div className="sidebar-settings-input-row">
                <label className="sidebar-settings-input-label">{t('settings.modelName')}</label>
                <input
                  className="sidebar-settings-input"
                  type="text"
                  value={modelConfig.model}
                  placeholder={t('settings.modelNamePlaceholder')}
                  onChange={(e) => handleModelConfigChange('model', e.target.value)}
                />
              </div>
            </div>

            <div className="sidebar-settings-divider" />

            <div className="sidebar-settings-row">
              <label className="sidebar-settings-toggle-row">
                <input
                  type="checkbox"
                  className="sidebar-settings-checkbox"
                  checked={autoApplyPatches}
                  onChange={(e) => setAutoApplyPatches(e.target.checked)}
                />
                <span className="sidebar-settings-label">{t('settings.autoApply')}</span>
              </label>
              <span className="sidebar-settings-hint">{t('settings.autoApplyDesc')}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          className={`workspace-treeItem${showSettings ? ' workspace-treeItemActive' : ''}`}
          onClick={handleToggleSettings}
        >
          <span className="material-symbols-outlined" aria-hidden="true">settings</span>
          <span>{t('nav.settings')}</span>
        </button>

        {showAccount && (
          <div className="sidebar-account-panel">
            <div className="sidebar-account-info">
              <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
              <span className="sidebar-account-name">{user?.displayName || user?.email}</span>
            </div>
            <button type="button" className="sidebar-logout-btn" onClick={logout}>
              <span className="material-symbols-outlined" aria-hidden="true">logout</span>
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          className={`workspace-treeItem${showAccount ? ' workspace-treeItemActive' : ''}`}
          onClick={handleToggleAccount}
        >
          <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
          <span>{t('nav.account')}</span>
        </button>
      </div>
    </nav>
  );
}
