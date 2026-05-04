import type { ProjectMeta } from '../../shared/store/appStore';

type ProjectCardProps = {
  project: ProjectMeta;
  typeLabel: string;
  onOpen: (project: ProjectMeta) => void;
};

export function ProjectCard({ project, typeLabel, onOpen }: ProjectCardProps) {
  return (
    <button
      type="button"
      className="projects-grid-card"
      onClick={() => onOpen(project)}
    >
      {project.coverImage ? (
        <img src={`file://${project.coverImage}`} alt="" className="projects-grid-card-cover" />
      ) : (
        <span className="material-symbols-outlined projects-grid-card-icon" aria-hidden="true">movie_creation</span>
      )}
      <span className="projects-grid-card-name">{project.name}</span>
      <span className="projects-grid-card-type">{typeLabel}</span>
    </button>
  );
}
