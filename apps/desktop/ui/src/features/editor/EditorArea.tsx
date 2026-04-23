import { storyboardFrames } from '../../shared/data/workspaceData';
import { useAppStore } from '../../shared/store/appStore';
import { OutlineEditor } from './OutlineEditor';
import { ScriptEditor } from './ScriptEditor';
import { VideoEditor } from './VideoEditor';

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

const editors = {
  outline: OutlineEditor,
  script: ScriptEditor,
  storyboard: StoryboardCanvas,
  video: VideoEditor,
} as const;

export function EditorArea() {
  const activeModule = useAppStore((s) => s.activeModule);
  const Editor = editors[activeModule];

  return (
    <div className="workspace-content">
      <AcceptedPatchesView />
      <Editor />
    </div>
  );
}
