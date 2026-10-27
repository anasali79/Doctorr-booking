import { apiFetch } from './client';
import { NotificationItem, ApiResponse } from '@/types';

export async function getNotifications(token: string) {
  return apiFetch<{
    message?: string;
    data: NotificationItem[];
  }>('/api/notifications', {
    token,
  });
}

export async function getUnreadCount(token: string) {
  return apiFetch<{
    message?: string;
    unreadCount: number;
  }>('/api/notifications/unread-count', {
    token,
  });
}

export async function markNotificationAsRead(id: string, token: string) {
  return apiFetch<ApiResponse<NotificationItem>>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    token,
  });
}

export async function markAllNotificationsAsRead(token: string) {
  return apiFetch<ApiResponse<{ count: number }>>('/api/notifications/read-all', {
    method: 'PATCH',
    token,
  });
}
