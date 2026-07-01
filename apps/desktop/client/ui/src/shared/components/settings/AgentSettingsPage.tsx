type Props = {
  t: (key: string) => string;
  autoApplyPatches: boolean;
  setAutoApplyPatches: (value: boolean) => void;
  agentSessionRetention: number;
  setAgentSessionRetention: (value: number) => void;
  agentDefaultModel: string;
  setAgentDefaultModel: (value: string) => void;
  modelOptions: Array<{ value: string; label: string }>;
};

export function AgentSettingsPage({
  t, autoApplyPatches, setAutoApplyPatches,
  agentSessionRetention, setAgentSessionRetention,
  agentDefaultModel, setAgentDefaultModel, modelOptions,
}: Props) {
  return (
    <div className="settings-page">
      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.agentPatchMode')}</h3>
        <div className="settings-toggle-group">
          <button
            type="button"
            className={`settings-toggle-btn${!autoApplyPatches ? ' is-active' : ''}`}
            onClick={() => setAutoApplyPatches(false)}
          >
            {t('settings.patchModeSuggest')}
          </button>
          <button
            type="button"
            className={`settings-toggle-btn${autoApplyPatches ? ' is-active' : ''}`}
            onClick={() => setAutoApplyPatches(true)}
          >
            {t('settings.patchModeAuto')}
          </button>
        </div>
        <p className="settings-hint">
          {autoApplyPatches ? t('settings.patchModeAutoHint') : t('settings.patchModeSuggestHint')}
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.agentSession')}</h3>
        <label className="settings-row">
          <span className="settings-row-label">{t('settings.sessionRetention')}</span>
          <input
            type="number"
            min={5}
            max={200}
            value={agentSessionRetention}
            onChange={(e) => setAgentSessionRetention(Number(e.target.value))}
            className="settings-input settings-input--narrow"
          />
        </label>
        <p className="settings-hint">{t('settings.sessionRetentionHint')}</p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t('settings.agentDefaultModel')}</h3>
        <select
          value={agentDefaultModel}
          onChange={(e) => setAgentDefaultModel(e.target.value)}
          className="settings-select"
        >
          <option value="">{t('settings.followGlobal')}</option>
          {modelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </section>
    </div>
  );
}
