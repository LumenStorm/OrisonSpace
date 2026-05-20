import { useState } from 'react';
import { useAppStore, type ActivePage } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { AccountDialog } from '../../shared/components/AccountDialog';
import { Tooltip } from '../../shared/components/Tooltip';
import {
  overviewItem, outlineItem, assetsItem, novelItem, scriptItem,
  productionItems, timelineItem, type PageNavItem,
} from './navItems';

function NavButton({ item, active, onClick, t }: { item: PageNavItem; active: boolean; onClick: () => void; t: (k: string) => string }) {
  return (
    <Tooltip label={t(item.i18nKey)} placement="right">
      <button
        type="button"
        className={`icon-rail-btn${active ? ' icon-rail-btnActive' : ''}`}
        onClick={onClick}
        aria-label={t(item.i18nKey)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
      </button>
    </Tooltip>
  );
}

export function SideNav() {
  const {
    activePage, setActivePage,
    currentProject, resolvedLocale,
    toggleAgentPanel, agentPanelOpen,
    activeSidebarPanel, setActiveSidebarPanel,
  } = useAppStore(useShallow((s) => ({
    activePage: s.activePage,
    setActivePage: s.setActivePage,
    currentProject: s.currentProject,
    resolvedLocale: s.resolvedLocale,
    toggleAgentPanel: s.toggleAgentPanel,
    agentPanelOpen: s.agentPanelOpen,
    activeSidebarPanel: s.activeSidebarPanel,
    setActiveSidebarPanel: s.setActiveSidebarPanel,
  })));

  const { t } = useI18n(resolvedLocale);
  const contentItem = currentProject?.type === 'script' ? scriptItem : novelItem;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const handlePage = (page: ActivePage) => setActivePage(page);

  const handleSearchClick = () => {
    setActiveSidebarPanel(activeSidebarPanel === 'search' ? 'explorer' : 'search');
  };

  // Check if there are open file tabs (file editing takes over the main area visually)
  const openFiles = useAppStore((s) => s.openFiles);
  const hasOpenFiles = openFiles.length > 0;

  return (
    <>
      <nav className="icon-rail" aria-label="Main Navigation">
        <div className="icon-rail-top">
          {/* --- Left panel switchers --- */}
          <Tooltip label={t('nav.explorer') || '资源管理器'} placement="right">
            <button
              type="button"
              className={`icon-rail-btn${activeSidebarPanel === 'explorer' ? ' icon-rail-btnActive' : ''}`}
              onClick={() => setActiveSidebarPanel('explorer')}
              aria-label={t('nav.explorer') || '资源管理器'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
            </button>
          </Tooltip>

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

          <div className="side-nav-separator" />

          {/* --- Group 1: Overview / Outline / Assets / Novel|Script --- */}
          <NavButton item={overviewItem} active={!hasOpenFiles && activePage === 'overview'} onClick={() => handlePage('overview')} t={t} />
          <NavButton item={outlineItem} active={!hasOpenFiles && activePage === 'outline'} onClick={() => handlePage('outline')} t={t} />
          <NavButton item={assetsItem} active={!hasOpenFiles && activePage === 'assets'} onClick={() => handlePage('assets')} t={t} />
          <NavButton item={contentItem} active={!hasOpenFiles && activePage === contentItem.id} onClick={() => handlePage(contentItem.id)} t={t} />

          <div className="side-nav-separator" />

          {/* --- Group 2: Production tools --- */}
          {productionItems.map((item) => (
            <NavButton key={item.id} item={item} active={!hasOpenFiles && activePage === item.id} onClick={() => handlePage(item.id)} t={t} />
          ))}

          <div className="side-nav-separator" />

          {/* --- Agent --- */}
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

          {/* --- Timeline (below Agent) --- */}
          <NavButton item={timelineItem} active={!hasOpenFiles && activePage === 'timeline'} onClick={() => handlePage('timeline')} t={t} />
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
