const actionGroups = [
  ['add', 'folder_open', 'save', 'ios_share'],
  ['undo', 'redo'],
  ['settings', 'help_outline']
];

export function TopBar() {
  return (
    <header className="workspace-topbar">
      <div className="workspace-brand">Orison Space</div>
      <div className="workspace-actions" aria-label="Workspace Actions">
        {actionGroups.map((group, index) => (
          <div key={group.join('-')} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {group.map((icon) => (
              <button key={icon} className="workspace-action" type="button" aria-label={icon}>
                <span className="material-symbols-outlined">{icon}</span>
              </button>
            ))}
            {index < actionGroups.length - 1 ? <div className="workspace-divider" /> : null}
          </div>
        ))}
      </div>
    </header>
  );
}
