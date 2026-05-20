import { useState } from 'react';
import { CreativeFieldsEditor } from '../creative/CreativeFieldsEditor';
import { useI18n } from '../../shared/i18n/useI18n';
import { useAppStore } from '../../shared/store/appStore';

type SubTab = 'content' | 'creative';

export function NovelScriptWithCreative({ ContentEditor }: { ContentEditor: React.FC }) {
  const [subTab, setSubTab] = useState<SubTab>('content');
  const resolvedLocale = useAppStore((state) => state.resolvedLocale);
  const activePage = useAppStore((state) => state.activePage);
  const { t } = useI18n(resolvedLocale);

  const contentLabel = activePage === 'novel' ? t('nav.novel') : t('nav.script');

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
