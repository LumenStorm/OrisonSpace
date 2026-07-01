type Props = {
  t: (key: string) => string;
  autoApplyPatches: boolean;
  setAutoApplyPatches: (value: boolean) => void;
  agentSessionRetention: number;
  setAgentSessionRetention: (value: number) => void;
};

export function AgentSettingsPage({
  t, autoApplyPatches, setAutoApplyPatches,
  agentSessionRetention, setAgentSessionRetention,
}: Props) {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.agent')}</h3>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.agentPatchMode')}</span>
        <div className="sidebar-settings-options">
          <button
            type="button"
            className={`sidebar-settings-option${!autoApplyPatches ? ' is-active' : ''}`}
            onClick={() => setAutoApplyPatches(false)}
          >
            {t('settings.patchModeSuggest')}
          </button>
          <button
            type="button"
            className={`sidebar-settings-option${autoApplyPatches ? ' is-active' : ''}`}
            onClick={() => setAutoApplyPatches(true)}
          >
            {t('settings.patchModeAuto')}
          </button>
        </div>
        <span className="sidebar-settings-hint">
          {autoApplyPatches ? t('settings.patchModeAutoHint') : t('settings.patchModeSuggestHint')}
        </span>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.sessionRetention')}</span>
        <div className="sidebar-settings-input-row">
          <input
            type="number"
            min={5}
            max={200}
            value={agentSessionRetention}
            onChange={(e) => setAgentSessionRetention(Number(e.target.value))}
            className="sidebar-settings-input"
            style={{ width: '80px' }}
          />
        </div>
        <span className="sidebar-settings-hint">{t('settings.sessionRetentionHint')}</span>
      </div>
    </div>
  );
}
