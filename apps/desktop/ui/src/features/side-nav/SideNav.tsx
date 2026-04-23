import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';

const navItems: { key: WorkspaceModule; icon: string; label: string }[] = [
  { key: 'outline', icon: 'auto_stories', label: 'Outline' },
  { key: 'script', icon: 'description', label: 'Script' },
  { key: 'storyboard', icon: 'view_quilt', label: 'Storyboard' },
  { key: 'video', icon: 'movie_filter', label: 'Video' },
];

export function SideNav() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);

  return (
    <nav className="workspace-sidebar" aria-label="Module Navigation">
      <div className="workspace-sidebarHeader">
        <h2 className="workspace-sidebarTitle">Project</h2>
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
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
