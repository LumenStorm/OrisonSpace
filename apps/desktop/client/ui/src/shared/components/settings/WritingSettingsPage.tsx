type Props = {
  t: (key: string) => string;
  paragraphIndent: boolean;
  setParagraphIndent: (value: boolean) => void;
  showWordCount: boolean;
  setShowWordCount: (value: boolean) => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (value: boolean) => void;
  persistPreferences: () => void;
  autoSaveInterval: number;
  setAutoSaveInterval: (value: number) => void;
  spellCheck: boolean;
  setSpellCheck: (value: boolean) => void;
  wordCountGoal: number;
  setWordCountGoal: (value: number) => void;
};

const INTERVAL_OPTIONS: { value: number; key: string }[] = [
  { value: 1000, key: 'settings.interval1s' },
  { value: 1500, key: 'settings.interval1_5s' },
  { value: 3000, key: 'settings.interval3s' },
  { value: 5000, key: 'settings.interval5s' },
  { value: 10000, key: 'settings.interval10s' },
];

export function WritingSettingsPage({
  t,
  paragraphIndent, setParagraphIndent,
  showWordCount, setShowWordCount,
  autoSaveEnabled, setAutoSaveEnabled, persistPreferences,
  autoSaveInterval, setAutoSaveInterval,
  spellCheck, setSpellCheck,
  wordCountGoal, setWordCountGoal,
}: Props) {
  const handleAutoSaveToggle = (value: boolean) => {
    // autoSaveEnabled lives in autoSaveSlice; persist the snapshot explicitly.
    setAutoSaveEnabled(value);
    persistPreferences();
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.writing')}</h3>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.autoSave')}</span>
        <div className="form-field-toggle-row">
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => handleAutoSaveToggle(e.target.checked)}
            className="form-field-checkbox"
            id="setting-autosave-enabled"
          />
          <label htmlFor="setting-autosave-enabled">{t('settings.autoSaveEnabled')}</label>
        </div>
        <span className="form-field-label">{t('settings.autoSaveInterval')}</span>
        <div className="form-field-options">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`form-field-option${autoSaveInterval === opt.value ? ' is-active' : ''}`}
              disabled={!autoSaveEnabled}
              onClick={() => setAutoSaveInterval(opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.editor')}</span>
        <div className="form-field-toggle-row">
          <input
            type="checkbox"
            checked={paragraphIndent}
            onChange={(e) => setParagraphIndent(e.target.checked)}
            className="form-field-checkbox"
            id="setting-paragraph-indent"
          />
          <label htmlFor="setting-paragraph-indent">{t('settings.paragraphIndent')}</label>
        </div>
        <div className="form-field-toggle-row">
          <input
            type="checkbox"
            checked={showWordCount}
            onChange={(e) => setShowWordCount(e.target.checked)}
            className="form-field-checkbox"
            id="setting-show-word-count"
          />
          <label htmlFor="setting-show-word-count">{t('settings.showWordCount')}</label>
        </div>
        <div className="form-field-toggle-row">
          <input
            type="checkbox"
            checked={spellCheck}
            onChange={(e) => setSpellCheck(e.target.checked)}
            className="form-field-checkbox"
            id="setting-spellcheck"
          />
          <label htmlFor="setting-spellcheck">{t('settings.spellCheck')}</label>
        </div>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.wordCountGoal')}</span>
        <div className="form-field-input-row">
          <input
            type="number"
            min={0}
            value={wordCountGoal}
            onChange={(e) => setWordCountGoal(Math.max(0, Number(e.target.value)))}
            className="form-field-input form-field-input-narrow"
          />
        </div>
        <span className="form-field-hint">{t('settings.wordCountGoalHint')}</span>
      </div>
    </div>
  );
}
