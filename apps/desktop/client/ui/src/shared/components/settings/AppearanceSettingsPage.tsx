type Props = {
  t: (key: string) => string;
  editorLineHeight: number;
  setEditorLineHeight: (value: number) => void;
};

const LINE_HEIGHT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1.5, label: '1.5' },
  { value: 1.75, label: '1.75' },
  { value: 2.0, label: '2.0' },
];

export function AppearanceSettingsPage({ t, editorLineHeight, setEditorLineHeight }: Props) {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.appearance')}</h3>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.editorLineHeight')}</span>
        <div className="sidebar-settings-options">
          {LINE_HEIGHT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`sidebar-settings-option${editorLineHeight === opt.value ? ' is-active' : ''}`}
              onClick={() => setEditorLineHeight(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
