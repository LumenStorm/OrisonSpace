type Props = {
  t: (key: string) => string;
  chapterPrefix: string;
  setChapterPrefix: (value: string) => void;
  paragraphIndent: boolean;
  setParagraphIndent: (value: boolean) => void;
  showWordCount: boolean;
  setShowWordCount: (value: boolean) => void;
};

export function WritingSettingsPage({
  t, chapterPrefix, setChapterPrefix,
  paragraphIndent, setParagraphIndent,
  showWordCount, setShowWordCount,
}: Props) {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.writing')}</h3>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.chapterPrefix')}</span>
        <div className="sidebar-settings-input-row">
          <input
            type="text"
            value={chapterPrefix}
            onChange={(e) => setChapterPrefix(e.target.value)}
            className="sidebar-settings-input"
            placeholder="ch-"
            style={{ width: '120px' }}
          />
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.editor')}</span>
        <div className="sidebar-settings-toggle-row">
          <input
            type="checkbox"
            checked={paragraphIndent}
            onChange={(e) => setParagraphIndent(e.target.checked)}
            className="sidebar-settings-checkbox"
            id="setting-paragraph-indent"
          />
          <label htmlFor="setting-paragraph-indent">{t('settings.paragraphIndent')}</label>
        </div>
        <div className="sidebar-settings-toggle-row">
          <input
            type="checkbox"
            checked={showWordCount}
            onChange={(e) => setShowWordCount(e.target.checked)}
            className="sidebar-settings-checkbox"
            id="setting-show-word-count"
          />
          <label htmlFor="setting-show-word-count">{t('settings.showWordCount')}</label>
        </div>
      </div>
    </div>
  );
}
