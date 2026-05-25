import type { ModelConfig } from '@orison/shared-contracts';
import { ProfileList } from './model/ProfileList';
import { ProfileEditor } from './model/ProfileEditor';
import { ProfileEmptyState } from './model/ProfileEmptyState';
import { DeleteConfirmDialog } from './model/DeleteConfirmDialog';
import { useModelLibrary } from './model/useModelLibrary';

type Props = {
  t: (key: string) => string;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig) => Promise<void>;
};

export function ModelSettingsPage({ t, modelConfig, setModelConfig }: Props) {
  const lib = useModelLibrary({ modelConfig, setModelConfig, t });
  const keys = modelConfig.keys;
  const showEmptyState = keys.length === 0 && lib.editorMode === 'idle';
  const showEditor = lib.editorMode === 'creating' || lib.editorMode === 'editing';

  return (
    <div className="settings-page model-library-page">
      <header className="settings-page-header model-page-header">
        <div>
          <h3 className="settings-page-title">{t('settings.modelConfig')}</h3>
          <p className="settings-page-subtitle">{t('settings.modelSubtitle')}</p>
        </div>
        <button type="button" className="settings-save-button" onClick={lib.startNewKey}>
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          {t('settings.addModel')}
        </button>
      </header>

      <div className="model-library-layout">
        {showEmptyState ? (
          <ProfileEmptyState variant="no-profiles" t={t} onAdd={lib.startNewKey} />
        ) : (
          <>
            <ProfileList
              keys={keys}
              activeKeyId={lib.draft.id}
              onSelectKey={lib.selectKey}
              onAddKey={lib.startNewKey}
              t={t}
            />
            {showEditor ? (
              <ProfileEditor
                draft={lib.draft}
                isDirty={lib.dirty}
                onChange={lib.updateDraft}
                onUpdateModelEntry={lib.updateModelEntry}
                onRemoveModelEntry={lib.removeModelEntry}
                onApply={() => void lib.applyDraft()}
                onDelete={lib.draft.id ? () => lib.requestDelete(lib.draft.id!) : null}
                refreshing={lib.refreshing}
                refreshError={lib.refreshError}
                remoteModels={lib.remoteModels}
                onRefreshModels={lib.refreshModels}
                notice={lib.notice}
                onDismissNotice={lib.dismissNotice}
                t={t}
              />
            ) : (
              <ProfileEmptyState variant="no-selection" t={t} />
            )}
          </>
        )}
      </div>

      <DeleteConfirmDialog
        open={lib.pendingDeleteId !== null}
        title={t('settings.deleteConfirmTitle')}
        description={
          lib.pendingDeleteKey
            ? t('settings.deleteConfirmDesc').replace('{name}', lib.pendingDeleteKey.name)
            : ''
        }
        confirmLabel={t('settings.deleteConfirmAction')}
        cancelLabel={t('projects.cancel')}
        onConfirm={() => void lib.confirmDelete()}
        onCancel={lib.cancelDelete}
      />
    </div>
  );
}
