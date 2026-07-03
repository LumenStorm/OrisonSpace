type Props = {
  t: (key: string) => string;
  paragraphIndent: boolean;
  setParagraphIndent: (value: boolean) => void;
  showWordCount: boolean;
  setShowWordCount: (value: boolean) => void;
};

export function WritingSettingsPage({
  t,
  paragraphIndent, setParagraphIndent,
  showWordCount, setShowWordCount,
}: Props) {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.writing')}</h3>
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
