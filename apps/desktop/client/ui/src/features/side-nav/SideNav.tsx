import { useState } from 'react';
import { useAppStore, type ActivePage } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';
import { SettingsDialog } from '../../shared/components/SettingsDialog';
import { Tooltip } from '../../shared/components/Tooltip';
import {
  overviewItem, outlineItem, assetsItem,
  productionItems, type PageNavItem,
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
    resolvedLocale,
    activeSidebarPanel, setActiveSidebarPanel,
    mainView,
    agentPanelOpen, toggleAgentPanel,
  } = useAppStore(useShallow((s) => ({
    activePage: s.activePage,
    setActivePage: s.setActivePage,
    resolvedLocale: s.resolvedLocale,
    activeSidebarPanel: s.activeSidebarPanel,
    setActiveSidebarPanel: s.setActiveSidebarPanel,
    mainView: s.mainView,
    agentPanelOpen: s.agentPanelOpen,
    toggleAgentPanel: s.toggleAgentPanel,
  })));

  const { t } = useI18n(resolvedLocale);

  const [showSettings, setShowSettings] = useState(false);

  const handlePage = (page: ActivePage) => setActivePage(page);

  const handleSearchClick = () => {
    setActiveSidebarPanel(activeSidebarPanel === 'search' ? 'explorer' : 'search');
  };

  const isPageActive = (page: ActivePage) => mainView === 'page' && activePage === page;

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

          <Tooltip label={t('nav.timeline') || '时间线'} placement="right">
            <button
              type="button"
              className={`icon-rail-btn${activeSidebarPanel === 'timeline' ? ' icon-rail-btnActive' : ''}`}
              onClick={() => setActiveSidebarPanel(activeSidebarPanel === 'timeline' ? 'explorer' : 'timeline')}
              aria-label={t('nav.timeline') || '时间线'}
            >
              <span className="material-symbols-outlined" aria-hidden="true">history</span>
            </button>
          </Tooltip>

          <div className="side-nav-separator" />

          {/* --- Group 1: Overview / Outline / Assets / Novel|Script --- */}
          <NavButton item={overviewItem} active={isPageActive('overview')} onClick={() => handlePage('overview')} t={t} />
          <NavButton item={outlineItem} active={isPageActive('outline')} onClick={() => handlePage('outline')} t={t} />
          <NavButton item={assetsItem} active={isPageActive('assets')} onClick={() => handlePage('assets')} t={t} />

          <div className="side-nav-separator" />

          {/* --- Group 2: Production tools --- */}
          {productionItems.map((item) => (
            <NavButton key={item.id} item={item} active={isPageActive(item.id)} onClick={() => handlePage(item.id)} t={t} />
          ))}

          <div className="side-nav-separator" />

          {/* --- Agent panel toggle --- */}
          <Tooltip label="Agent" placement="right">
            <button
              type="button"
              className={`icon-rail-btn${agentPanelOpen ? ' icon-rail-btnActive' : ''}`}
              onClick={toggleAgentPanel}
              aria-label="Agent"
            >
              <span className="material-symbols-outlined" aria-hidden="true">assistant</span>
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

        </div>
      </nav>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </>
  );
}
