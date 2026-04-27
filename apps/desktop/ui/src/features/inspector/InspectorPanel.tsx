import { useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { moduleFields, aspectRatios, promptKeys } from '../../shared/data/inspectorFields';
import { PatchReviewPanel } from '../creative/PatchReviewPanel';

export function InspectorPanel() {
  const activeModule = useAppStore((s) => s.activeModule);
  const pendingPatch = useAppStore((s) => s.pendingPatch);
  const submitRewrite = useAppStore((s) => s.submitRewrite);
  const currentTask = useAppStore((s) => s.currentTask);
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const toggleInspector = useAppStore((s) => s.toggleInspector);
  const { t, tArray } = useI18n(resolvedLocale);
  const [prompt, setPrompt] = useState('');

  const showPatchReview = (activeModule === 'novel' || activeModule === 'script') && pendingPatch;
  const promptKey = promptKeys[activeModule];
  const taskRunning =
    currentTask?.result === null ||
    currentTask?.result?.status === 'queued' ||
    currentTask?.result?.status === 'running';

  const fields = moduleFields[activeModule] ?? [];
  const ratios = aspectRatios[activeModule] ?? [];

  useEffect(() => {
    setPrompt('');
  }, [activeModule]);

  return (
    <aside className="workspace-inspector" aria-label="Inspector Panel">
      <div className="workspace-inspectorHeader">
        <div className="workspace-inspectorHeaderRow">
          <h3 className="workspace-inspectorTitle">{t('inspector.title')}</h3>
          <button
            type="button"
            className="inspector-collapse-btn"
            aria-label="Collapse Inspector"
            onClick={toggleInspector}
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
        <p className="workspace-inspectorMeta">
          {t('inspector.parameters', {
            module: activeModule.charAt(0).toUpperCase() + activeModule.slice(1)
          })}
        </p>
      </div>
      <div className="workspace-inspectorBody">
        {showPatchReview ? (
          <PatchReviewPanel />
        ) : (
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
                  {ratios.map((ratio, index) => (
                    <button
                      key={ratio}
                      className={`inspector-segment${index === 0 ? ' inspector-segmentActive' : ''}`}
                      type="button"
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label>
              <div className="inspector-label">{t('inspector.generateWithAI')}</div>
              <textarea
                className="inspector-textarea"
                placeholder={t(promptKey)}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="inspector-cta"
              onClick={() => submitRewrite(prompt)}
              disabled={!prompt.trim() || taskRunning}
            >
              {t('tasks.runRewrite')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
