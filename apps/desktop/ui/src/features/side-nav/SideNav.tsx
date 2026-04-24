import { useState } from 'react';
import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type NavItem = { key: WorkspaceModule; icon: string; i18nKey: string };

const novelNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'novel', icon: 'menu_book', i18nKey: 'nav.novel' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

const scriptNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'script', icon: 'description', i18nKey: 'nav.script' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

export function SideNav() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const currentProject = useAppStore((s) => s.currentProject);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const { t } = useI18n(resolvedLocale);

  const navItems = currentProject?.type === 'novel' ? novelNavItems : scriptNavItems;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

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
              onClick={() => setActiveModule(item.key)}
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
          </div>
        )}

        <button
          type="button"
          className={`workspace-treeItem${showSettings ? ' workspace-treeItemActive' : ''}`}
          onClick={() => { setShowSettings((v) => !v); setShowAccount(false); }}
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
          onClick={() => { setShowAccount((v) => !v); setShowSettings(false); }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
          <span>{t('nav.account')}</span>
        </button>
      </div>
    </nav>
  );
}
