import { useState } from 'react';
import { CreativeFieldsEditor } from '../creative/CreativeFieldsEditor';
import { NovelWorkbench } from '../novel-workbench/NovelWorkbench';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';

type SubTab = 'content' | 'creative' | 'workbench';

export function NovelScriptWithCreative({ ContentEditor }: { ContentEditor: React.FC }) {
  const [subTab, setSubTab] = useState<SubTab>('content');
  const resolvedLocale = useAppStore((state) => state.resolvedLocale);
  const activeModule = useAppStore((state) => state.activeModule);
  const { t } = useI18n(resolvedLocale);

  const contentLabel = activeModule === 'novel' ? t('nav.novel') : t('nav.script');
  const isNovel = activeModule === 'novel';

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
        {isNovel ? (
          <button
            type="button"
            className={`editor-sub-tab${subTab === 'workbench' ? ' editor-sub-tabActive' : ''}`}
            onClick={() => setSubTab('workbench')}
          >
            绔犺妭宸ヤ綔鍙?
          </button>
        ) : null}
      </nav>
      <div className="editor-sub-content">
        {subTab === 'content' ? (
          <ContentEditor />
        ) : subTab === 'creative' ? (
          <CreativeFieldsEditor />
        ) : (
          <NovelWorkbench />
        )}
      </div>
    </div>
  );
}
