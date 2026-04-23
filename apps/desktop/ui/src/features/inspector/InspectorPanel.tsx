import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';

type FieldDef = {
  label: string;
  options: string[];
  selected: string;
};

const moduleFields: Record<WorkspaceModule, FieldDef[]> = {
  outline: [
    { label: 'Visual Style', options: ['Cinematic', 'Anime', 'Watercolor', 'Noir', 'Realistic'], selected: 'Cinematic' },
    { label: 'Narrative Style', options: ['Linear', 'Non-linear', 'Episodic', 'Parallel'], selected: 'Linear' },
    { label: 'Pacing', options: ['Slow burn', 'Fast-paced', 'Rhythmic', 'Gradual'], selected: 'Slow burn' },
    { label: 'Tone', options: ['Dark', 'Light', 'Suspenseful', 'Comedic', 'Dramatic'], selected: 'Dramatic' },
  ],
  script: [
    { label: 'Scene Type', options: ['Interior', 'Exterior', 'INT/EXT'], selected: 'Interior' },
    { label: 'Time of Day', options: ['Day', 'Night', 'Dawn', 'Dusk', 'Continuous'], selected: 'Day' },
    { label: 'Dialogue Style', options: ['Natural', 'Formal', 'Poetic', 'Minimal'], selected: 'Natural' },
    { label: 'Format', options: ['Screenplay', 'Novel', 'Stage Play'], selected: 'Screenplay' },
  ],
  storyboard: [
    { label: 'Camera Lens', options: ['24mm Wide', '35mm Standard', '50mm Portrait', '85mm Telephoto'], selected: '35mm Standard' },
    { label: 'Lighting Mood', options: ['Natural', 'High Key', 'Low Key', 'Neon', 'Golden Hour'], selected: 'Natural' },
    { label: 'Shot Type', options: ['Wide', 'Medium', 'Close-up', 'Extreme Close-up', 'Over-the-shoulder'], selected: 'Medium' },
  ],
  video: [
    { label: 'Resolution', options: ['1080p', '2K', '4K'], selected: '1080p' },
    { label: 'Frame Rate', options: ['24fps', '30fps', '60fps'], selected: '24fps' },
    { label: 'Output Format', options: ['MP4', 'MOV', 'WebM'], selected: 'MP4' },
  ],
};

const aspectRatios: Record<WorkspaceModule, string[]> = {
  outline: [],
  script: [],
  storyboard: ['16:9', '2.35:1', '4:3', '9:16'],
  video: ['16:9', '2.35:1', '4:3', '9:16'],
};

const aiPrompts: Record<WorkspaceModule, string> = {
  outline: 'Describe how to refine the story outline...',
  script: 'Describe dialogue or scene adjustments...',
  storyboard: 'Describe the frame details to refine the image...',
  video: 'Describe video generation parameters...',
};

const aiActions: Record<WorkspaceModule, string> = {
  outline: 'Rewrite Outline',
  script: 'Rewrite Scene',
  storyboard: 'Render Frame',
  video: 'Generate Video',
};

export function InspectorPanel() {
  const activeModule = useAppStore((s) => s.activeModule);
  const fields = moduleFields[activeModule];
  const ratios = aspectRatios[activeModule];

  return (
    <aside className="workspace-inspector" aria-label="Inspector Panel">
      <div className="workspace-inspectorHeader">
        <h3 className="workspace-inspectorTitle">Inspector</h3>
        <p className="workspace-inspectorMeta">{activeModule.charAt(0).toUpperCase() + activeModule.slice(1)} Parameters</p>
      </div>
      <div className="workspace-inspectorBody">
        <div className="inspector-group">
          {fields.map((field) => (
            <label key={field.label}>
              <div className="inspector-label">{field.label}</div>
              <select className="inspector-select" defaultValue={field.selected}>
                {field.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
          {ratios.length > 0 && (
            <div>
              <div className="inspector-label">Aspect Ratio</div>
              <div className="inspector-segmented" role="group" aria-label="Aspect Ratio">
                {ratios.map((r, i) => (
                  <button
                    key={r}
                    className={`inspector-segment${i === 0 ? ' inspector-segmentActive' : ''}`}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="workspace-divider" style={{ width: '100%', height: '1px', margin: 0 }} />
        <div className="inspector-group">
          <div className="inspector-label">Generate with AI</div>
          <textarea
            className="inspector-textarea"
            placeholder={aiPrompts[activeModule]}
            defaultValue=""
          />
          <button className="inspector-cta" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
            {aiActions[activeModule]}
          </button>
        </div>
      </div>
    </aside>
  );
}
