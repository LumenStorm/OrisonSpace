import { useState } from 'react';
import { inferApiFormat } from '@orison/model-protocols';
import type { GenerationProvider, ModelApiFormat } from '@orison/shared-contracts';
import type { RemoteModel } from '../../../api/generation';
import { CapabilityToggleGroup } from './CapabilityToggleGroup';
import { ProviderBadge } from './ProviderBadge';
import { EditorBanner } from './EditorBanner';
import { EditorFooter } from './EditorFooter';
import {
  API_FORMAT_OPTIONS,
  PROVIDER_DESCRIPTORS,
  getProviderDescriptor,
  type ProfileDraft,
  type ProfileDraftModel,
} from './utils';

type Props = {
  draft: ProfileDraft;
  isDirty: boolean;
  onChange: (next: Partial<ProfileDraft>) => void;
  onUpdateModelEntry: (index: number, values: Partial<ProfileDraftModel>) => void;
  onRemoveModelEntry: (index: number) => void;
  onApply: () => void;
  onDelete: (() => void) | null;
  refreshing: boolean;
  refreshError: string | null;
  remoteModels: RemoteModel[];
  onRefreshModels: () => Promise<void>;
  notice: string | null;
  onDismissNotice: () => void;
  t: (key: string) => string;
};

export function ProfileEditor({
  draft,
  isDirty,
  onChange,
  onUpdateModelEntry,
  onRemoveModelEntry,
  onApply,
  onDelete,
  refreshing,
  refreshError,
  remoteModels,
  onRefreshModels,
  notice,
  onDismissNotice,
  t,
}: Props) {
  const [showApiKey, setShowApiKey] = useState(false);
  const isNew = draft.id === null;

  const handleProviderChange = (next: GenerationProvider) => {
    if (next === draft.provider) return;
    const descriptor = getProviderDescriptor(next);
    onChange({
      provider: next,
      models: [],
      baseUrl: descriptor.defaultBaseUrl,
    });
  };

  const canApply = isDirty && draft.models.length > 0 && draft.models.every((m) => m.id.trim().length > 0);

  return (
    <section className="model-profile-editor" aria-label={t('settings.modelDetails')}>
      <header className="model-editor-header">
        <h4 className="model-editor-title">
          {isNew ? t('settings.addModel') : t('settings.modelDetails')}
        </h4>
        <ProviderBadge provider={draft.provider} t={t} />
      </header>

      {refreshError ? (
        <EditorBanner variant="error" message={`${t('settings.refreshFailedBanner')} — ${refreshError}`} />
      ) : null}
      {notice ? (
        <EditorBanner variant="notice" message={notice} onDismiss={onDismissNotice} />
      ) : null}

      <div className="model-editor-section">
        <span className="sidebar-settings-label">{t('settings.identitySection')}</span>

        <label className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.profileName')}</span>
          <input
            className="sidebar-settings-input"
            value={draft.name}
            placeholder={t('settings.modelNamePlaceholder')}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>

        <label className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.provider')}</span>
          <select
            className="sidebar-settings-input"
            value={draft.provider}
            onChange={(event) => handleProviderChange(event.target.value as GenerationProvider)}
          >
            {PROVIDER_DESCRIPTORS.map((descriptor) => (
              <option key={descriptor.id} value={descriptor.id}>
                {t(descriptor.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="model-editor-section">
        <span className="sidebar-settings-label">{t('settings.credentialsSection')}</span>

        <label className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.apiKey')}</span>
          <div className="sidebar-settings-input-wrap settings-refresh-row">
            <input
              className="sidebar-settings-input"
              type={showApiKey ? 'text' : 'password'}
              value={draft.apiKey}
              placeholder={t('settings.apiKeyPlaceholder')}
              onChange={(event) => onChange({ apiKey: event.target.value })}
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
              onClick={() => void onRefreshModels()}
              disabled={refreshing}
              aria-label={t('settings.refreshModels')}
              title={t('settings.refreshModels')}
            >
              <span className={`material-symbols-outlined${refreshing ? ' is-spinning' : ''}`}>refresh</span>
            </button>
          </div>
          <span className="sidebar-settings-hint api-key-hint">
            <span className="material-symbols-outlined" aria-hidden="true">lock</span>
            {t('settings.apiKeyEncrypted')}
          </span>
        </label>

        <label className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.baseUrl')}</span>
          <input
            className="sidebar-settings-input"
            value={draft.baseUrl}
            placeholder={t('settings.baseUrlPlaceholder')}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
          />
        </label>
      </div>

      <div className="model-editor-section">
        <span className="sidebar-settings-label">{t('settings.modelSection')}</span>

        {draft.models.length === 0 ? (
          <p className="image-gen-empty">
            {remoteModels.length === 0
              ? t('settings.refreshModels')
              : t('settings.modelSelectPlaceholder')}
          </p>
        ) : (
          <div className="model-entry-table">
            {draft.models.map((entry, index) => (
              <div key={`${entry.id}_${index}`} className="model-entry-row">
                <label className="sidebar-settings-input-row">
                  <span className="sidebar-settings-input-label">{t('settings.modelName')}</span>
                  <input
                    className="sidebar-settings-input"
                    value={entry.id}
                    onChange={(event) =>
                      onUpdateModelEntry(index, {
                        id: event.target.value,
                        apiFormat: inferApiFormat(event.target.value, draft.provider) as ModelApiFormat,
                      })
                    }
                  />
                </label>
                <label className="sidebar-settings-input-row">
                  <span className="sidebar-settings-input-label">{t('settings.modelAlias')}</span>
                  <input
                    className="sidebar-settings-input"
                    value={entry.alias}
                    onChange={(event) => onUpdateModelEntry(index, { alias: event.target.value })}
                  />
                </label>
                <label className="sidebar-settings-input-row">
                  <span className="sidebar-settings-input-label">apiFormat</span>
                  <select
                    className="sidebar-settings-input"
                    value={entry.apiFormat}
                    onChange={(event) =>
                      onUpdateModelEntry(index, { apiFormat: event.target.value as ModelApiFormat })
                    }
                  >
                    {API_FORMAT_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <div className="sidebar-settings-input-row">
                  <span className="sidebar-settings-input-label">{t('settings.capabilities')}</span>
                  <CapabilityToggleGroup
                    value={entry.capabilities}
                    onChange={(capabilities) => onUpdateModelEntry(index, { capabilities })}
                    t={t}
                  />
                </div>
                <button
                  type="button"
                  className="settings-refresh-button"
                  onClick={() => onRemoveModelEntry(index)}
                  aria-label="Remove model"
                  title="Remove model"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditorFooter
        isDirty={isDirty}
        isNew={isNew}
        canApply={canApply}
        onApply={onApply}
        onDelete={onDelete}
        t={t}
      />
    </section>
  );
}
