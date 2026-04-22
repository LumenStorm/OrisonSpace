import { moduleItems, storyboardFrames } from '../../shared/data/workspaceData';
import { useAppStore } from '../../shared/store/appStore';

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

export function EditorTabs() {
  const activeModule = useAppStore((state) => state.activeModule);
  const setActiveModule = useAppStore((state) => state.setActiveModule);

  return (
    <>
      <div className="workspace-tabs" role="tablist" aria-label="Editor Modules">
        {moduleItems.map((item) => (
          <button
            key={item.key}
            className={`workspace-tab${item.key === activeModule ? ' workspace-tabActive' : ''}`}
            role="tab"
            aria-selected={item.key === activeModule}
            type="button"
            onClick={() => setActiveModule(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="workspace-content">
        <AcceptedPatchesView />
        <StoryboardCanvas />
      </div>
    </>
  );
}
