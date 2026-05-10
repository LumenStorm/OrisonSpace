import { useCallback, useMemo, useState } from 'react';
import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AccountDialog } from '../../shared/components/AccountDialog';
import { Tooltip } from '../../shared/components/Tooltip';
import { novelNavItems, scriptNavItems } from './navItems';

export function SideNav({ ariaLabel }: { ariaLabel?: string }) {
  const {
    activeModule, setActiveModule,
    currentProject, resolvedLocale,
    novelWorkspace,
    enterNovelWorkspace,
    openGuidedNovelWorkspace,
    selectNovelObjectCategory,
  } = useAppStore(useShallow((s) => ({
    activeModule: s.activeModule,
    setActiveModule: s.setActiveModule,
    currentProject: s.currentProject,
    resolvedLocale: s.resolvedLocale,
    novelWorkspace: s.novelWorkspace,
    enterNovelWorkspace: s.enterNovelWorkspace,
    openGuidedNovelWorkspace: s.openGuidedNovelWorkspace,
    selectNovelObjectCategory: s.selectNovelObjectCategory,
  })));

  const { t } = useI18n(resolvedLocale);
  const navItems = currentProject?.type === 'novel' ? novelNavItems : scriptNavItems;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const handleModuleClick = useCallback((key: WorkspaceModule) => setActiveModule(key), [setActiveModule]);

  const handleNovelNavClick = useCallback((item: (typeof novelNavItems)[number]) => {
    setActiveModule(item.key);
    if (item.novelRoute === 'home') {
      enterNovelWorkspace();
      return;
    }
    if (item.novelRoute === 'guided') {
      openGuidedNovelWorkspace();
      return;
    }
    if (item.objectCategory) {
      selectNovelObjectCategory(item.objectCategory);
    }
  }, [enterNovelWorkspace, openGuidedNovelWorkspace, selectNovelObjectCategory, setActiveModule]);

  const isNovelActive = useCallback((item: (typeof novelNavItems)[number]) => {
    if (item.novelRoute === 'home') return novelWorkspace.route === 'home';
    if (item.novelRoute === 'guided') return novelWorkspace.route === 'guided';
    if (item.objectCategory) return novelWorkspace.objectCategory === item.objectCategory;
    return false;
  }, [novelWorkspace.objectCategory, novelWorkspace.route]);

  const navAriaLabel = ariaLabel ?? (currentProject?.type === 'novel' ? 'Novel Object Navigation' : 'Main Navigation');
  const isNovelProject = currentProject?.type === 'novel';

  return (
    <>
      <nav className="icon-rail" aria-label={navAriaLabel}>
        <div className="icon-rail-top">
          {navItems.map((item) => (
            <Tooltip key={`${item.key}-${item.i18nKey}`} label={t(item.i18nKey)} placement="right">
              <button
                type="button"
                className={`icon-rail-btn${
                  isNovelProject
                    ? (isNovelActive(item as (typeof novelNavItems)[number]) ? ' icon-rail-btnActive' : '')
                    : (activeModule === item.key ? ' icon-rail-btnActive' : '')
                }`}
                onClick={() => isNovelProject ? handleNovelNavClick(item as (typeof novelNavItems)[number]) : handleModuleClick(item.key)}
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
