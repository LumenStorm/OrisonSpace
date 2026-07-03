type Props = {
  t: (key: string) => string;
  autoApplyPatches: boolean;
  setAutoApplyPatches: (value: boolean) => void;
};

export function AgentSettingsPage({ t, autoApplyPatches, setAutoApplyPatches }: Props) {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.agent')}</h3>
      </div>

      <div className="form-field-row">
        <span className="form-field-label">{t('settings.agentPatchMode')}</span>
        <div className="form-field-options">
          <button
            type="button"
            className={`form-field-option${!autoApplyPatches ? ' is-active' : ''}`}
            onClick={() => setAutoApplyPatches(false)}
          >
            {t('settings.patchModeSuggest')}
          </button>
          <button
            type="button"
            className={`form-field-option${autoApplyPatches ? ' is-active' : ''}`}
            onClick={() => setAutoApplyPatches(true)}
          >
            {t('settings.patchModeAuto')}
          </button>
        </div>
        <span className="form-field-hint">
          {autoApplyPatches ? t('settings.patchModeAutoHint') : t('settings.patchModeSuggestHint')}
        </span>
      </div>
    </div>
  );
}
