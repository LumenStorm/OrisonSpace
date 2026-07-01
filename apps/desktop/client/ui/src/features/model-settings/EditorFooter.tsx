type Props = {
  isDirty: boolean;
  isNew: boolean;
  canApply: boolean;
  onApply: () => void;
  onDelete: (() => void) | null;
  t: (key: string) => string;
};

export function EditorFooter({ isDirty, isNew: _isNew, canApply, onApply, onDelete, t }: Props) {
  const applyLabel = t('settings.applyChanges');

  return (
    <footer className="model-editor-actions">
      {onDelete ? (
        <button
          type="button"
          className="settings-danger-button"
          onClick={onDelete}
          aria-label={t('settings.deleteModel')}
          title={t('settings.deleteModel')}
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      ) : null}

      <div className="model-editor-actions-spacer" />

      {isDirty ? (
        <span className="model-editor-dirty-hint">
          <span className="model-editor-dirty-dot" aria-hidden="true" />
          {t('settings.unsavedHint')}
        </span>
      ) : null}

      <button
        type="button"
        className={`settings-save-button${isDirty ? ' is-emphasized' : ''}`}
        onClick={onApply}
        disabled={!canApply}
      >
        {applyLabel}
      </button>
    </footer>
  );
}
