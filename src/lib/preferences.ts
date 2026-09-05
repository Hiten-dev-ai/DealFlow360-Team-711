export interface NotificationPreferences {
  desktopAlerts: boolean;
  soundAlerts: boolean;
  priorityOnly: boolean;
  dnd: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  desktopAlerts: true,
  soundAlerts: true,
  priorityOnly: false,
  dnd: false,
};
