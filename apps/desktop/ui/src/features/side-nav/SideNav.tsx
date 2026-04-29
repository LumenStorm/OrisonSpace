import { useCallback, useState } from 'react';
import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AccountDialog } from '../../shared/components/AccountDialog';
import { Tooltip } from '../../shared/components/Tooltip';

type NavItem = { key: WorkspaceModule; icon: string; i18nKey: string };

const novelNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'novel', icon: 'menu_book', i18nKey: 'nav.novel' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

const scriptNavItems: NavItem[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'script', icon: 'description', i18nKey: 'nav.script' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'image_gen', icon: 'image', i18nKey: 'nav.imageGen' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

export function SideNav() {
  const {
    activeModule, setActiveModule,
    currentProject, resolvedLocale,
  } = useAppStore(useShallow((s) => ({
    activeModule: s.activeModule,
    setActiveModule: s.setActiveModule,
    currentProject: s.currentProject,
    resolvedLocale: s.resolvedLocale,
  })));

  const { t } = useI18n(resolvedLocale);
  const navItems = currentProject?.type === 'novel' ? novelNavItems : scriptNavItems;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const handleModuleClick = useCallback(
    (key: WorkspaceModule) => setActiveModule(key),
    [setActiveModule],
  );

  return (
    <>
      <nav className="icon-rail" aria-label="Project Tree">
        <div className="icon-rail-top">
          {navItems.map((item) => (
            <Tooltip key={item.key} label={t(item.i18nKey)} placement="right">
              <button
                type="button"
                className={`icon-rail-btn${activeModule === item.key ? ' icon-rail-btnActive' : ''}`}
                onClick={() => handleModuleClick(item.key)}
                aria-label={t(item.i18nKey)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              </button>
            </Tooltip>
          ))}
        </div>

        <div className="icon-rail-bottom">
          <Tooltip label={t('nav.settings')} placement="right">
            <button
              type="button"
              className={`icon-rail-btn${showSettings ? ' icon-rail-btnActive' : ''}`}
              onClick={() => setShowSettings(true)}
              aria-label={t('nav.settings')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">settings</span>
            </button>
          </Tooltip>

          <Tooltip label={t('nav.account')} placement="right">
            <button
              type="button"
              className={`icon-rail-btn${showAccount ? ' icon-rail-btnActive' : ''}`}
              onClick={() => setShowAccount(true)}
              aria-label={t('nav.account')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
            </button>
          </Tooltip>
        </div>
      </nav>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showAccount && <AccountDialog onClose={() => setShowAccount(false)} />}
    </>
  );
}
