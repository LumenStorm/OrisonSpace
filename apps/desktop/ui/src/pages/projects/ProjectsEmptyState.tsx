type ProjectsEmptyStateProps = {
  title: string;
  hint: string;
  newLabel: string;
  openLabel: string;
  onNew: () => void;
  onOpen: () => void;
};

export function ProjectsEmptyState({
  title,
  hint,
  newLabel,
  openLabel,
  onNew,
  onOpen,
}: ProjectsEmptyStateProps) {
  return (
    <div className="projects-empty">
      <span className="material-symbols-outlined projects-empty-icon" aria-hidden="true">folder_open</span>
      <h2 className="projects-empty-title">{title}</h2>
      <p className="projects-empty-hint">{hint}</p>
      <div className="projects-empty-actions">
        <button type="button" className="auth-submit" onClick={onNew}>
          {newLabel}
        </button>
        <button type="button" className="auth-submit projects-empty-open" onClick={onOpen}>
          {openLabel}
        </button>
      </div>
    </div>
  );
}
