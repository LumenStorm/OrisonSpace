import { useAppStore, type WorkspaceModule } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

type FieldDef = {
  labelKey: string;
  optionsKey: string;
  defaultIndex: number;
};

const moduleFields: Record<WorkspaceModule, FieldDef[]> = {
  outline: [
    { labelKey: 'inspector.outline.visualStyle', optionsKey: 'inspector.outline.options.visualStyle', defaultIndex: 0 },
    { labelKey: 'inspector.outline.narrativeStyle', optionsKey: 'inspector.outline.options.narrativeStyle', defaultIndex: 0 },
    { labelKey: 'inspector.outline.pacing', optionsKey: 'inspector.outline.options.pacing', defaultIndex: 0 },
    { labelKey: 'inspector.outline.tone', optionsKey: 'inspector.outline.options.tone', defaultIndex: 4 },
  ],
  novel: [
    { labelKey: 'inspector.script.sceneType', optionsKey: 'inspector.script.options.sceneType', defaultIndex: 0 },
    { labelKey: 'inspector.script.timeOfDay', optionsKey: 'inspector.script.options.timeOfDay', defaultIndex: 0 },
    { labelKey: 'inspector.script.dialogueStyle', optionsKey: 'inspector.script.options.dialogueStyle', defaultIndex: 0 },
    { labelKey: 'inspector.script.format', optionsKey: 'inspector.script.options.format', defaultIndex: 0 },
  ],
  script: [
    { labelKey: 'inspector.script.sceneType', optionsKey: 'inspector.script.options.sceneType', defaultIndex: 0 },
    { labelKey: 'inspector.script.timeOfDay', optionsKey: 'inspector.script.options.timeOfDay', defaultIndex: 0 },
    { labelKey: 'inspector.script.dialogueStyle', optionsKey: 'inspector.script.options.dialogueStyle', defaultIndex: 0 },
    { labelKey: 'inspector.script.format', optionsKey: 'inspector.script.options.format', defaultIndex: 0 },
  ],
  storyboard: [
    { labelKey: 'inspector.storyboard.cameraLens', optionsKey: 'inspector.storyboard.options.cameraLens', defaultIndex: 1 },
    { labelKey: 'inspector.storyboard.lightingMood', optionsKey: 'inspector.storyboard.options.lightingMood', defaultIndex: 0 },
    { labelKey: 'inspector.storyboard.shotType', optionsKey: 'inspector.storyboard.options.shotType', defaultIndex: 1 },
  ],
  video: [
    { labelKey: 'inspector.video.resolution', optionsKey: 'inspector.video.options.resolution', defaultIndex: 0 },
    { labelKey: 'inspector.video.frameRate', optionsKey: 'inspector.video.options.frameRate', defaultIndex: 0 },
    { labelKey: 'inspector.video.outputFormat', optionsKey: 'inspector.video.options.outputFormat', defaultIndex: 0 },
  ],
};

const aspectRatios: Record<WorkspaceModule, string[]> = {
  outline: [],
  novel: [],
  script: [],
  storyboard: ['16:9', '2.35:1', '4:3', '9:16'],
  video: ['16:9', '2.35:1', '4:3', '9:16'],
};

const promptKeys: Record<WorkspaceModule, string> = {
  outline: 'inspector.outline.prompt',
  novel: 'inspector.script.prompt',
  script: 'inspector.script.prompt',
  storyboard: 'inspector.storyboard.prompt',
  video: 'inspector.video.prompt',
};

const actionKeys: Record<WorkspaceModule, string> = {
  outline: 'inspector.outline.rewrite',
  novel: 'inspector.script.rewrite',
  script: 'inspector.script.rewrite',
  storyboard: 'inspector.storyboard.rewrite',
  video: 'inspector.video.rewrite',
};

export function InspectorPanel() {
  const activeModule = useAppStore((s) => s.activeModule);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const { t, tArray } = useI18n(resolvedLocale);

  const fields = moduleFields[activeModule];
  const ratios = aspectRatios[activeModule];

  return (
    <aside className="workspace-inspector" aria-label="Inspector Panel">
      <div className="workspace-inspectorHeader">
        <h3 className="workspace-inspectorTitle">{t('inspector.title')}</h3>
        <p className="workspace-inspectorMeta">{t('inspector.parameters', { module: activeModule.charAt(0).toUpperCase() + activeModule.slice(1) })}</p>
      </div>
      <div className="workspace-inspectorBody">
        <div className="inspector-group">
          {fields.map((field) => {
            const options = tArray(field.optionsKey);
            return (
              <label key={field.labelKey}>
                <div className="inspector-label">{t(field.labelKey)}</div>
                <select className="inspector-select" defaultValue={options[field.defaultIndex] ?? ''}>
                  {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            );
          })}
          {ratios.length > 0 && (
            <div>
              <div className="inspector-label">{t('inspector.aspectRatio')}</div>
              <div className="inspector-segmented" role="group" aria-label={t('inspector.aspectRatio')}>
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
          <div className="inspector-label">{t('inspector.generateWithAI')}</div>
          <textarea
            className="inspector-textarea"
            placeholder={t(promptKeys[activeModule])}
            defaultValue=""
          />
          <button className="inspector-cta" type="button">
            <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
            {t(actionKeys[activeModule])}
          </button>
        </div>
      </div>
    </aside>
  );
}
