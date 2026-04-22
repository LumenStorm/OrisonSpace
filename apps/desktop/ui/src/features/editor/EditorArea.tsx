import { storyboardFrames } from '../../shared/data/workspaceData';
import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';

function StoryboardCanvas() {
  return (
    <div className="storyboard-grid" aria-label="Storyboard Canvas">
      {storyboardFrames.map((frame, index) => (
        <article key={frame.id} className="storyboard-card">
          <div className={`storyboard-frame${index === 2 ? ' storyboard-frameActive' : ''}`}>
            <div className="storyboard-badge">{frame.id}</div>
          </div>
          <p className="storyboard-copy">{frame.title}</p>
        </article>
      ))}
    </div>
  );
}

function PlaceholderView({ module }: { module: WorkspaceModule }) {
  const labels: Record<WorkspaceModule, string> = {
    story: 'Outline Editor',
    script: 'Script Editor',
    storyboard: 'Storyboard',
    video: 'Video Timeline',
  };
  return (
    <div className="editor-placeholder">
      <span className="material-symbols-outlined" aria-hidden="true">construction</span>
      <p>{labels[module]} — coming soon</p>
    </div>
  );
}

function AcceptedPatchesView() {
  const patches = useAppStore((s) => s.acceptedPatches);
  if (patches.length === 0) return null;

  return (
    <div className="accepted-patches">
      {patches.map((op, i) => (
        <div key={i}>
          <label>{op.path}</label>
          <input readOnly value={String(op.value)} />
        </div>
      ))}
    </div>
  );
}

export function EditorArea() {
  const activeModule = useAppStore((s) => s.activeModule);

  return (
    <div className="workspace-content">
      <AcceptedPatchesView />
      {activeModule === 'storyboard' ? (
        <StoryboardCanvas />
      ) : (
        <PlaceholderView module={activeModule} />
      )}
    </div>
  );
}
