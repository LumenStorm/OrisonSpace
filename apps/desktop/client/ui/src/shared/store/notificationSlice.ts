import type { StateCreator } from 'zustand';

export type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  icon?: string;
  timestamp: number;
  read: boolean;
};

export type NotificationSlice = {
  notifications: NotificationItem[];
  unreadCount: number;
  notificationPanelOpen: boolean;
  toggleNotificationPanel: () => void;
  pushNotification: (title: string, body?: string, icon?: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
};

export const createNotificationSlice: StateCreator<NotificationSlice, [], [], NotificationSlice> = (set, get) => ({
  notifications: [],
  unreadCount: 0,
  notificationPanelOpen: false,
  toggleNotificationPanel: () => {
    const opening = !get().notificationPanelOpen;
    if (opening) {
      set({ notificationPanelOpen: true, notifications: get().notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 });
    } else {
      set({ notificationPanelOpen: false });
    }
  },
  pushNotification: (title, body, icon) => {
    const item: NotificationItem = { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, body, icon, timestamp: Date.now(), read: false };
    const next = [item, ...get().notifications].slice(0, 50);
    set({ notifications: next, unreadCount: next.filter((n) => !n.read).length });
  },
  markAllRead: () => set({ notifications: get().notifications.map((n) => ({ ...n, read: true })), unreadCount: 0 }),
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
});
