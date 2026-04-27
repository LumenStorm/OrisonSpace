import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n/useI18n';
import { useShallow } from 'zustand/react/shallow';

type Props = { onClose: () => void };

export function AccountDialog({ onClose }: Props) {
  const { resolvedLocale, user, logout } = useAppStore(useShallow((s) => ({
    resolvedLocale: s.resolvedLocale,
    user: s.user,
    logout: s.logout,
  })));

  const { t } = useI18n(resolvedLocale);

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="topbar-new-dialog-overlay" onClick={onClose}>
      <div className="settings-dialog settings-dialog-sm" onClick={(e) => e.stopPropagation()}>
        <div className="settings-dialog-header">
          <h2 className="settings-dialog-title">{t('nav.account')}</h2>
          <button type="button" className="settings-dialog-close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="settings-dialog-body">
          <div className="account-dialog-profile">
            <span className="material-symbols-outlined account-dialog-avatar" aria-hidden="true">account_circle</span>
            <div className="account-dialog-info">
              {user?.displayName && <div className="account-dialog-name">{user.displayName}</div>}
              <div className="account-dialog-email">{user?.email}</div>
            </div>
          </div>

          <div className="sidebar-settings-divider" />

          <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
            <span className="material-symbols-outlined" aria-hidden="true">logout</span>
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
