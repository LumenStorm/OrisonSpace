import { inspectorFields } from '../../shared/data/workspaceData';

export function InspectorPanel() {
  return (
    <aside className="workspace-inspector" aria-label="Inspector Panel">
      <div className="workspace-inspectorHeader">
        <h3 className="workspace-inspectorTitle">Inspector</h3>
        <p className="workspace-inspectorMeta">Contextual Parameters</p>
      </div>
      <div className="workspace-inspectorBody">
        <div className="inspector-group">
          {inspectorFields.map((field) => (
            <label key={field.label}>
              <div className="inspector-label">{field.label}</div>
              <select className="inspector-select" defaultValue={field.selected}>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div>
            <div className="inspector-label">Aspect Ratio</div>
            <div className="inspector-segmented" role="group" aria-label="Aspect Ratio">
              <button className="inspector-segment" type="button">
                16:9
              </button>
              <button className="inspector-segment inspector-segmentActive" type="button">
                2.35:1
              </button>
              <button className="inspector-segment" type="button">
                4:3
              </button>
            </div>
          </div>
        </div>
        <div className="workspace-divider" style={{ width: '100%', height: '1px', margin: 0 }} />
        <div className="inspector-group">
          <div className="inspector-label">Generate with AI</div>
          <textarea
            className="inspector-textarea"
            placeholder="Describe the frame details to refine the image..."
            defaultValue=""
          />
          <button className="inspector-cta" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">
              auto_awesome
            </span>
            Render Frame
          </button>
        </div>
      </div>
    </aside>
  );
}
