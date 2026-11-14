import {notificationListSchema, type NotificationDto} from '@other-half/contracts';
import {apiRequest} from './api';

export async function getNotifications(signal?: AbortSignal) {
  const payload = await apiRequest<unknown>('/notifications', {signal});
  const parsed = notificationListSchema.safeParse(payload);
  if (!parsed.success) throw new Error('The notification service returned an invalid response.');
  return parsed.data;
}

export async function markNotificationRead(id: string) {
  await apiRequest<void>(`/notifications/${encodeURIComponent(id)}/read`, {method: 'POST'});
}

export async function markAllNotificationsRead() {
  await apiRequest<void>('/notifications/read-all', {method: 'POST'});
}

export function notificationAge(item: NotificationDto) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(item.createdAt)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(item.createdAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'});
}
