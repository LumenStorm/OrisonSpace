import type { ThemeSetting } from '../../store/types';

type Props = {
  t: (key: string) => string;
  theme: ThemeSetting;
  setTheme: (theme: ThemeSetting) => void;
  uiDensity: 'compact' | 'default' | 'spacious';
  setUiDensity: (value: 'compact' | 'default' | 'spacious') => void;
  sidebarWidth: number;
  setSidebarWidth: (value: number) => void;
  editorLineHeight: number;
  setEditorLineHeight: (value: number) => void;
};

const DENSITY_OPTIONS: Array<{ value: 'compact' | 'default' | 'spacious'; key: string }> = [
  { value: 'compact', key: 'settings.densityCompact' },
  { value: 'default', key: 'settings.densityDefault' },
  { value: 'spacious', key: 'settings.densitySpacious' },
];

const LINE_HEIGHT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1.5, label: '1.5' },
  { value: 1.75, label: '1.75' },
  { value: 2.0, label: '2.0' },
];

export function AppearanceSettingsPage({
  t, theme, setTheme, uiDensity, setUiDensity,
  sidebarWidth, setSidebarWidth, editorLineHeight, setEditorLineHeight,
}: Props) {
  return (
    <div className="settings-page">
      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.theme')}</h3>
        <div className="settings-toggle-group">
          {(['system', 'light', 'dark'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`settings-toggle-btn${theme === v ? ' is-active' : ''}`}
              onClick={() => setTheme(v)}
            >
              {t(`settings.theme_${v}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.uiDensity')}</h3>
        <div className="settings-toggle-group">
          {DENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`settings-toggle-btn${uiDensity === opt.value ? ' is-active' : ''}`}
              onClick={() => setUiDensity(opt.value)}
            >
              {t(opt.key)}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.sidebarWidth')}</h3>
        <div className="settings-slider-row">
          <input
            type="range"
            min={180}
            max={360}
            step={10}
            value={sidebarWidth}
            onChange={(e) => setSidebarWidth(Number(e.target.value))}
            className="settings-slider"
          />
          <span className="settings-slider-value">{sidebarWidth}px</span>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.editorLineHeight')}</h3>
        <div className="settings-toggle-group">
          {LINE_HEIGHT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`settings-toggle-btn${editorLineHeight === opt.value ? ' is-active' : ''}`}
              onClick={() => setEditorLineHeight(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
