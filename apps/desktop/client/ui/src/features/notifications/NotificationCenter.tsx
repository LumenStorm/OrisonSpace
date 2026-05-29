import { useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../shared/store/appStore';
import { useI18n } from '../../shared/i18n/useI18n';

export function NotificationCenter() {
  const { notifications, unreadCount, notificationPanelOpen, toggleNotificationPanel, clearNotifications, resolvedLocale } = useAppStore(useShallow((s) => ({
    notifications: s.notifications,
    unreadCount: s.unreadCount,
    notificationPanelOpen: s.notificationPanelOpen,
    toggleNotificationPanel: s.toggleNotificationPanel,
    clearNotifications: s.clearNotifications,
    resolvedLocale: s.resolvedLocale,
  })));
  const { t } = useI18n(resolvedLocale);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notificationPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        toggleNotificationPanel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notificationPanelOpen, toggleNotificationPanel]);

  return (
    <div className="notification-center" ref={panelRef}>
      <button type="button" className="notification-bell" onClick={toggleNotificationPanel} aria-label={t('notifications.title')}>
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {notificationPanelOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span className="notification-dropdown-title">{t('notifications.title')}</span>
            {notifications.length > 0 && (
              <button type="button" className="notification-clear-btn" onClick={clearNotifications}>
                {t('notifications.clearAll')}
              </button>
            )}
          </div>
          <div className="notification-dropdown-list">
            {notifications.length === 0 ? (
              <p className="notification-empty">{t('notifications.empty')}</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="notification-item">
                  <span className="material-symbols-outlined notification-item-icon">{n.icon || 'info'}</span>
                  <div className="notification-item-body">
                    <span className="notification-item-title">{n.title}</span>
                    {n.body && <span className="notification-item-desc">{n.body}</span>}
                    <span className="notification-item-time">{formatTime(n.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '<1m';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString();
}
