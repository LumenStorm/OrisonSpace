import { useState } from 'react';
import { storyboardFrames } from '../../shared/data/workspaceData';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';
import { OutlineEditor } from './OutlineEditor';
import { ScriptEditor } from './ScriptEditor';
import { VideoEditor } from './VideoEditor';
import { CreativeFieldsEditor } from '../creative/CreativeFieldsEditor';

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

type SubTab = 'content' | 'creative';

function NovelScriptWithCreative({ ContentEditor }: { ContentEditor: React.FC }) {
  const [subTab, setSubTab] = useState<SubTab>('content');
  const resolvedLocale = useAppStore((s) => s.resolvedLocale);
  const activeModule = useAppStore((s) => s.activeModule);
  const { t } = useI18n(resolvedLocale);

  const contentLabel = activeModule === 'novel' ? t('nav.novel') : t('nav.script');

  return (
    <div className="editor-with-creative">
      <nav className="editor-sub-tabs" aria-label="Editor Sub Tabs">
        <button
          type="button"
          className={`editor-sub-tab${subTab === 'content' ? ' editor-sub-tabActive' : ''}`}
          onClick={() => setSubTab('content')}
        >
          {contentLabel}
        </button>
        <button
          type="button"
          className={`editor-sub-tab${subTab === 'creative' ? ' editor-sub-tabActive' : ''}`}
          onClick={() => setSubTab('creative')}
        >
          {t('nav.creative')}
        </button>
      </nav>
      <div className="editor-sub-content">
        {subTab === 'content' ? <ContentEditor /> : <CreativeFieldsEditor />}
      </div>
    </div>
  );
}

const simpleEditors = {
  outline: OutlineEditor,
  storyboard: StoryboardCanvas,
  video: VideoEditor,
} as const;

export function EditorArea() {
  const activeModule = useAppStore((s) => s.activeModule);

  if (activeModule === 'novel' || activeModule === 'script') {
    return (
      <div className="workspace-content">
        <AcceptedPatchesView />
        <NovelScriptWithCreative ContentEditor={ScriptEditor} />
      </div>
    );
  }

  const Editor = simpleEditors[activeModule];

  return (
    <div className="workspace-content">
      <AcceptedPatchesView />
      <Editor />
    </div>
  );
}
