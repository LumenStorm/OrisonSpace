type Props = {
  variant: 'no-profiles' | 'no-selection';
  t: (key: string) => string;
  onAdd?: () => void;
};

export function ProfileEmptyState({ variant, t, onAdd }: Props) {
  if (variant === 'no-profiles') {
    return (
      <div className="model-empty-state" role="status">
        <span className="material-symbols-outlined model-empty-icon" aria-hidden="true">
          smart_toy
        </span>
        <h4 className="model-empty-title">{t('settings.emptyTitle')}</h4>
        <p className="model-empty-hint">{t('settings.emptyHint')}</p>
        {onAdd ? (
          <button type="button" className="settings-save-button" onClick={onAdd}>
            {t('settings.emptyAction')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="model-empty-state model-empty-state-subtle" role="status">
      <span className="material-symbols-outlined model-empty-icon" aria-hidden="true">
        west
      </span>
      <p className="model-empty-hint">{t('settings.selectProfileHint')}</p>
    </div>
  );
}
