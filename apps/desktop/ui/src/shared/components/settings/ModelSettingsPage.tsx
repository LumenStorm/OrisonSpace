import { useEffect, useState } from 'react';
import type { GenerationProvider, ModelConfig, ModelSlotConfig, ModelType } from '@orison/shared-contracts';
import { loadProviderModels, type RemoteModel } from '../../api/generation';

type Props = {
  t: (key: string) => string;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => Promise<void>;
};

const MODEL_TYPES: Array<{ id: ModelType; labelKey: string; capability: 'text' | 'image' | 'video'; fallback: string[] }> = [
  { id: 'novel', labelKey: 'settings.novelModel', capability: 'text', fallback: ['gpt-4o'] },
  { id: 'image', labelKey: 'settings.imageModel', capability: 'image', fallback: ['gpt-image-1'] },
  { id: 'video', labelKey: 'settings.videoModel', capability: 'video', fallback: ['placeholder-video'] },
];

const PROVIDERS: GenerationProvider[] = ['openai', 'gcp', 'anthropic'];

export function ModelSettingsPage({ t, modelConfig, setModelConfig }: Props) {
  const [activeType, setActiveType] = useState<ModelType>('novel');
  const [showApiKey, setShowApiKey] = useState(false);
  const [draft, setDraft] = useState<ModelConfig>(modelConfig);
  const [providerModels, setProviderModels] = useState<Record<ModelType, RemoteModel[]>>({
    novel: [],
    image: [],
    video: [],
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(modelConfig);
  }, [modelConfig]);

  const activeMeta = MODEL_TYPES.find((item) => item.id === activeType) ?? MODEL_TYPES[0];
  const activeSlot = draft.models[activeType];
  const modelOptions = mergeCurrentModel(
    providerModels[activeType]
      .filter((model) => model.capabilities.includes(activeMeta.capability))
      .map((model) => model.id),
    activeSlot.model,
    activeMeta.fallback,
  );

  function updateActiveSlot(field: keyof ModelSlotConfig, value: string) {
    setDraft((current: ModelConfig) => ({
      ...current,
      models: {
        ...current.models,
        [activeType]: {
          ...current.models[activeType],
          [field]: value,
        },
      },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setModelConfig(draft);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshModels() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await loadProviderModels({
        provider: activeSlot.provider,
        apiKey: activeSlot.apiKey,
        baseUrl: activeSlot.baseUrl,
      });
      setProviderModels((current) => ({ ...current, [activeType]: response }));
      setSaved(false);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : t('settings.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h3 className="settings-page-title">{t('settings.modelConfig')}</h3>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t('settings.modelType')}</span>
        <div className="sidebar-settings-options">
          {MODEL_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`sidebar-settings-option${activeType === type.id ? ' is-active' : ''}`}
              onClick={() => {
                setActiveType(type.id);
                setRefreshError(null);
              }}
            >
              {t(type.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-settings-row">
        <span className="sidebar-settings-label">{t(activeMeta.labelKey)}</span>

        <div className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.provider')}</span>
          <select
            className="sidebar-settings-input"
            value={activeSlot.provider}
            onChange={(e) => {
              updateActiveSlot('provider', e.target.value);
              setProviderModels((current) => ({ ...current, [activeType]: [] }));
            }}
          >
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
        </div>

        <div className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.apiKey')}</span>
          <div className="sidebar-settings-input-wrap settings-refresh-row">
            <input
              className="sidebar-settings-input"
              type={showApiKey ? 'text' : 'password'}
              placeholder={t('settings.apiKeyPlaceholder')}
              value={activeSlot.apiKey}
              onChange={(e) => updateActiveSlot('apiKey', e.target.value)}
            />
            <button
              type="button"
              className="sidebar-settings-input-toggle"
              onClick={() => setShowApiKey((value) => !value)}
              aria-label={showApiKey ? t('settings.hideKey') : t('settings.showKey')}
            >
              <span className="material-symbols-outlined">
                {showApiKey ? 'visibility_off' : 'visibility'}
              </span>
            </button>
            <button
              type="button"
              className="settings-refresh-button"
              onClick={handleRefreshModels}
              disabled={refreshing}
              aria-label={t('settings.refreshModels')}
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
        </div>

        <div className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.baseUrl')}</span>
          <input
            className="sidebar-settings-input"
            type="text"
            placeholder={t('settings.baseUrlPlaceholder')}
            value={activeSlot.baseUrl}
            onChange={(e) => updateActiveSlot('baseUrl', e.target.value)}
          />
          {refreshError ? <span className="sidebar-settings-hint">{refreshError}</span> : null}
        </div>

        <div className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.modelName')}</span>
          <select
            className="sidebar-settings-input"
            value={activeSlot.model}
            onChange={(e) => updateActiveSlot('model', e.target.value)}
          >
            {modelOptions.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          {activeType === 'video' ? (
            <span className="sidebar-settings-hint">{t('settings.videoModelPlaceholder')}</span>
          ) : null}
        </div>
      </div>

      <div className="settings-page-actions">
        <span className="sidebar-settings-hint">{saved ? t('settings.saved') : ''}</span>
        <button
          type="button"
          className="settings-save-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
      </div>
    </div>
  );
}

function mergeCurrentModel(models: string[], current: string, fallback: string[]): string[] {
  const merged = new Set([...models, ...fallback]);
  if (current) merged.add(current);
  return [...merged];
}
