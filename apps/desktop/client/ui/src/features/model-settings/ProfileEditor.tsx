import { useState } from 'react';
import type { RemoteModel } from '@orison/shared-contracts';
import { EditorBanner } from './EditorBanner';
import { EditorFooter } from './EditorFooter';
import type { KeyDraft, KeyDraftModel } from './utils';

type Props = {
  draft: KeyDraft;
  isDirty: boolean;
  onChange: (next: Partial<KeyDraft>) => void;
  onUpdateModelEntry: (index: number, values: Partial<KeyDraftModel>) => void;
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
  const canApply = isDirty && draft.models.length > 0 && draft.models.every((m) => m.id.trim().length > 0);

  return (
    <section className="model-profile-editor" aria-label={t('settings.modelDetails')}>
      <header className="model-editor-header">
        <h4 className="model-editor-title">
          {isNew ? t('settings.addModel') : t('settings.modelDetails')}
        </h4>
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
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>

        <label className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.baseUrl')}</span>
          <input
            className="sidebar-settings-input"
            value={draft.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => onChange({ baseUrl: e.target.value })}
          />
        </label>

        <label className="sidebar-settings-input-row">
          <span className="sidebar-settings-input-label">{t('settings.apiKey')}</span>
          <div className="sidebar-settings-input-group">
            <input
              className="sidebar-settings-input"
              type={showApiKey ? 'text' : 'password'}
              value={draft.apiKey}
              placeholder="sk-..."
              onChange={(e) => onChange({ apiKey: e.target.value })}
            />
            <button
              type="button"
              className="settings-refresh-button"
              onClick={() => setShowApiKey(!showApiKey)}
              aria-label={showApiKey ? t('settings.hideKey') : t('settings.showKey')}
            >
              <span className="material-symbols-outlined">
                {showApiKey ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </label>
      </div>

      <div className="model-editor-section">
        <div className="model-editor-section-header">
          <span className="sidebar-settings-label">{t('settings.modelsSection')}</span>
          <button
            type="button"
            className="settings-refresh-button"
            onClick={() => void onRefreshModels()}
            disabled={refreshing}
            aria-label={t('settings.refreshModels')}
            title={t('settings.refreshModels')}
          >
            <span className={`material-symbols-outlined${refreshing ? ' spin' : ''}`}>sync</span>
          </button>
        </div>

        {draft.models.length === 0 ? (
          <p className="model-editor-empty-hint">{t('settings.noModelsHint')}</p>
        ) : (
          <div className="model-entry-list">
            {draft.models.map((entry, index) => (
              <div key={`${entry.id}-${index}`} className="model-entry-row">
                <label className="model-entry-toggle">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(e) => onUpdateModelEntry(index, { enabled: e.target.checked })}
                  />
                </label>
                <span className="model-entry-id">{entry.id}</span>
                <span className="model-entry-alias">{entry.alias}</span>
                <span className={`model-entry-cap model-entry-cap-${entry.capability}`}>
                  {entry.capability}
                </span>
                <button
                  type="button"
                  className="settings-refresh-button"
                  onClick={() => onRemoveModelEntry(index)}
                  aria-label={t('settings.removeModel')}
                  title={t('settings.removeModel')}
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
