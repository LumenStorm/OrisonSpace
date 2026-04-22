import { projectTreeItems } from '../../shared/data/workspaceData';
import { useAppStore } from '../../shared/store/appStore';

export function ProjectTree() {
  const activeModule = useAppStore((state) => state.activeModule);

  return (
    <nav className="workspace-sidebar" aria-label="Project Tree">
      <div className="workspace-sidebarHeader">
        <h2 className="workspace-sidebarTitle">Project Files</h2>
        <p className="workspace-sidebarMeta">AI Feature Film v1</p>
      </div>
      <div className="workspace-tree">
        {projectTreeItems.map((item) => {
          const active = item.key === activeModule;

          return (
            <div
              key={item.key}
              className={`workspace-treeItem${active ? ' workspace-treeItemActive' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
