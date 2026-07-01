type Props = {
  t: (key: string) => string;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (value: boolean) => void;
  autoSaveInterval: number;
  setAutoSaveInterval: (value: number) => void;
  chapterPrefix: string;
  setChapterPrefix: (value: string) => void;
  paragraphIndent: boolean;
  setParagraphIndent: (value: boolean) => void;
  showWordCount: boolean;
  setShowWordCount: (value: boolean) => void;
};

const INTERVAL_OPTIONS: Array<{ value: number; key: string }> = [
  { value: 1000, key: 'settings.interval1s' },
  { value: 1500, key: 'settings.interval1_5s' },
  { value: 3000, key: 'settings.interval3s' },
  { value: 5000, key: 'settings.interval5s' },
  { value: 10000, key: 'settings.interval10s' },
];

export function WritingSettingsPage({
  t, autoSaveEnabled, setAutoSaveEnabled, autoSaveInterval, setAutoSaveInterval,
  chapterPrefix, setChapterPrefix, paragraphIndent, setParagraphIndent,
  showWordCount, setShowWordCount,
}: Props) {
  return (
    <div className="settings-page">
      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.autoSave')}</h3>
        <label className="settings-row">
          <span className="settings-row-label">{t('settings.autoSaveEnabled')}</span>
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => setAutoSaveEnabled(e.target.checked)}
            className="settings-checkbox"
          />
        </label>
        <label className="settings-row">
          <span className="settings-row-label">{t('settings.autoSaveInterval')}</span>
          <select
            value={autoSaveInterval}
            onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
            className="settings-select"
            disabled={!autoSaveEnabled}
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.chapter')}</h3>
        <label className="settings-row">
          <span className="settings-row-label">{t('settings.chapterPrefix')}</span>
          <input
            type="text"
            value={chapterPrefix}
            onChange={(e) => setChapterPrefix(e.target.value)}
            className="settings-input"
            placeholder="ch-"
          />
        </label>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.editor')}</h3>
        <label className="settings-row">
          <span className="settings-row-label">{t('settings.paragraphIndent')}</span>
          <input
            type="checkbox"
            checked={paragraphIndent}
            onChange={(e) => setParagraphIndent(e.target.checked)}
            className="settings-checkbox"
          />
        </label>
        <label className="settings-row">
          <span className="settings-row-label">{t('settings.showWordCount')}</span>
          <input
            type="checkbox"
            checked={showWordCount}
            onChange={(e) => setShowWordCount(e.target.checked)}
            className="settings-checkbox"
          />
        </label>
      </section>
    </div>
  );
}
