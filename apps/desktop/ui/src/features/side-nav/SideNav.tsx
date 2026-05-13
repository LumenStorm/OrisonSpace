import { useCallback, useState } from 'react';
import { useAppStore, type WorkspaceModule, type SidebarPanel } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AccountDialog } from '../../shared/components/AccountDialog';
import { Tooltip } from '../../shared/components/Tooltip';
import { novelNavItems, scriptNavItems, moduleTabItems } from './navItems';

export function SideNav() {
  const {
    activeModule, setActiveModule,
    currentProject, resolvedLocale,
    toggleAgentPanel, agentPanelOpen,
    activeSidebarPanel, setActiveSidebarPanel,
    openModuleTab, activeFilePath,
  } = useAppStore(useShallow((s) => ({
    activeModule: s.activeModule,
    setActiveModule: s.setActiveModule,
    currentProject: s.currentProject,
    resolvedLocale: s.resolvedLocale,
    toggleAgentPanel: s.toggleAgentPanel,
    agentPanelOpen: s.agentPanelOpen,
    activeSidebarPanel: s.activeSidebarPanel,
    setActiveSidebarPanel: s.setActiveSidebarPanel,
    openModuleTab: s.openModuleTab,
    activeFilePath: s.activeFilePath,
  })));

  const { t } = useI18n(resolvedLocale);
  const navItems = currentProject?.type === 'novel' ? novelNavItems : scriptNavItems;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const handleModuleClick = useCallback(
    (key: WorkspaceModule) => setActiveModule(key),
    [setActiveModule],
  );

  const handleModuleTabClick = useCallback(
    (id: string, label: string) => openModuleTab(id, label),
    [openModuleTab],
  );

  const handleSearchClick = useCallback(() => {
    setActiveSidebarPanel(activeSidebarPanel === 'search' ? 'explorer' : 'search');
  }, [activeSidebarPanel, setActiveSidebarPanel]);

  const handleExplorerClick = useCallback(() => {
    setActiveSidebarPanel('explorer');
  }, [setActiveSidebarPanel]);

  return (
    <>
      <nav className="icon-rail" aria-label="Main Navigation">
        <div className="icon-rail-top">
          {/* Explorer (file tree) */}
          <Tooltip label={t('nav.explorer') || '资源管理器'} placement="right">
            <button
              type="button"
              className={`icon-rail-btn${activeSidebarPanel === 'explorer' ? ' icon-rail-btnActive' : ''}`}
              onClick={handleExplorerClick}
              aria-label={t('nav.explorer') || '资源管理器'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
            </button>
          </Tooltip>

          {/* Search */}
          <Tooltip label={t('nav.search') || '搜索'} placement="right">
            <button
              type="button"
              className={`icon-rail-btn${activeSidebarPanel === 'search' ? ' icon-rail-btnActive' : ''}`}
              onClick={handleSearchClick}
              aria-label={t('nav.search') || '搜索'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">search</span>
            </button>
          </Tooltip>

          {/* Module switchers (outline, novel/script) */}
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

          {/* Module tab openers (storyboard, image_gen, video) */}
          {moduleTabItems.map((item) => (
            <Tooltip key={item.id} label={t(item.i18nKey)} placement="right">
              <button
                type="button"
                className={`icon-rail-btn${activeFilePath === `__module__/${item.id}` ? ' icon-rail-btnActive' : ''}`}
                onClick={() => handleModuleTabClick(item.id, item.label)}
                aria-label={t(item.i18nKey)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              </button>
            </Tooltip>
          ))}

          {/* Agent */}
          <Tooltip label="Agent" placement="right">
            <button
              type="button"
              className={`icon-rail-btn${agentPanelOpen ? ' icon-rail-btnActive' : ''}`}
              onClick={toggleAgentPanel}
              aria-label="Agent"
            >
              <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
            </button>
          </Tooltip>
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
