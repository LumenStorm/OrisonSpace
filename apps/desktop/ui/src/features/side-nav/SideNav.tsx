import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

const navItems: { key: WorkspaceModule; icon: string; i18nKey: string }[] = [
  { key: 'outline', icon: 'auto_stories', i18nKey: 'nav.outline' },
  { key: 'script', icon: 'description', i18nKey: 'nav.script' },
  { key: 'storyboard', icon: 'view_quilt', i18nKey: 'nav.storyboard' },
  { key: 'video', icon: 'movie_filter', i18nKey: 'nav.video' },
];

export function SideNav() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t } = useI18n(resolvedLocale);

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
    </nav>
  );
}
