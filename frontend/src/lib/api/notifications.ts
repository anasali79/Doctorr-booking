import { apiFetch } from './client';
import {
  NotificationItem,
  NotificationPreference,
  NotificationDeliveryItem,
  NotificationDeliveryStats,
  ApiResponse,
} from '@/types';

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

export async function getNotificationPreferences(token: string) {
  return apiFetch<ApiResponse<NotificationPreference>>('/api/notifications/preferences', {
    token,
  });
}

export async function updateNotificationPreferences(
  data: Partial<NotificationPreference>,
  token: string,
) {
  return apiFetch<ApiResponse<NotificationPreference>>('/api/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export async function getAdminNotificationLogs(token: string, channel?: string, status?: string) {
  const params = new URLSearchParams();
  if (channel) params.append('channel', channel);
  if (status) params.append('status', status);
  const q = params.toString() ? `?${params.toString()}` : '';

  return apiFetch<{
    success: boolean;
    data: NotificationDeliveryItem[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>(`/api/notifications/admin/logs${q}`, {
    token,
  });
}

export async function getAdminNotificationStats(token: string) {
  return apiFetch<{
    success: boolean;
    data: NotificationDeliveryStats;
  }>('/api/notifications/admin/stats', {
    token,
  });
}

export async function retryNotificationDelivery(deliveryId: string, token: string) {
  return apiFetch<{
    success: boolean;
    message: string;
  }>(`/api/notifications/admin/${deliveryId}/retry`, {
    method: 'POST',
    token,
  });
}
