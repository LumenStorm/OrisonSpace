import type { ProjectMeta } from '../../shared/store/appStore';

type ProjectCardProps = {
  project: ProjectMeta;
  typeLabel: string;
  onOpen: (project: ProjectMeta) => void;
  onMenuRequest: (project: ProjectMeta, x: number, y: number) => void;
  contextActive?: boolean;
};

export function ProjectCard({ project, typeLabel, onOpen, onMenuRequest, contextActive = false }: ProjectCardProps) {
  return (
    <button
      type="button"
      className={`projects-grid-card${contextActive ? ' is-context-active' : ''}`}
      onClick={() => onOpen(project)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        onMenuRequest(project, event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onMenuRequest(project, rect.left + Math.min(rect.width / 2, 48), rect.top + Math.min(rect.height / 2, 48));
      }}
    >
      {project.coverImage ? (
        <img src={`orison-file:///${project.coverImage}`} alt="" className="projects-grid-card-cover" />
      ) : (
        <span className="material-symbols-outlined projects-grid-card-icon" aria-hidden="true">movie_creation</span>
      )}
      <span className="projects-grid-card-name">{project.name}</span>
      <span className="projects-grid-card-type">{typeLabel}</span>
    </button>
  );
}
