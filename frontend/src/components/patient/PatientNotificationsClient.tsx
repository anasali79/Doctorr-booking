'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationItem } from '@/types';
import { formatDate, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import { Bell, CheckCheck, Inbox, Loader2, Settings, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { NotificationPreferencesDialog } from '@/components/common/NotificationPreferencesDialog';

interface MetaData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PatientNotificationsClientProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount?: number;
  initialMeta?: MetaData;
}

export function PatientNotificationsClient({
  initialNotifications,
  initialUnreadCount,
  initialMeta = { total: initialNotifications.length, page: 1, limit: 20, totalPages: 1 },
}: PatientNotificationsClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(
    initialUnreadCount !== undefined
      ? initialUnreadCount
      : initialNotifications.filter((n) => !n.isRead).length
  );
  const [meta, setMeta] = useState<MetaData>(initialMeta);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const notifyChange = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notification_updated'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await clientAxios.patch('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      notifyChange();
      toast.success('All notifications marked as read');
      router.refresh();
    } catch (err: unknown) {
      toast.error('Error updating notifications', { description: extractErrorMessage(err) });
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await clientAxios.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      notifyChange();
      router.refresh();
    } catch {
      // Best effort
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || meta.page >= meta.totalPages) return;
    try {
      setLoadingMore(true);
      const nextPage = meta.page + 1;
      const res = await clientAxios.get<any>(`/api/notifications?page=${nextPage}&limit=${meta.limit}`);
      const newItems = res.data?.data || [];
      const newMeta = res.data?.meta || { ...meta, page: nextPage };
      setNotifications((prev) => [...prev, ...newItems]);
      setMeta(newMeta);
    } catch (err: unknown) {
      toast.error('Failed to load more notifications', { description: extractErrorMessage(err) });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">
              {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
            </span>
            {meta.total > 0 && (
              <span className="text-xs text-slate-400 font-medium">
                (Showing {notifications.length} of {meta.total})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Click any unread notification to mark it as read.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreferencesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer h-auto"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Preferences</span>
          </Button>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60 h-auto"
            >
              {markingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>Mark all as read</span>
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card py-16 text-center p-8 space-y-2 bg-white">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            No Notifications
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You have received no clinical alerts or booking notifications yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => !item.isRead && handleMarkSingleRead(item.id)}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                item.isRead
                  ? 'bg-white border-slate-200/80'
                  : 'bg-blue-50/40 border-blue-200/70 shadow-xs'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  item.isRead
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-blue-700 text-white shadow-xs'
                }`}
              >
                <Bell className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={`text-sm font-semibold truncate ${
                      item.isRead ? 'text-slate-800' : 'text-slate-900 font-bold'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {item.createdAt ? formatDateTime(item.createdAt) : ''}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.message}
                </p>

                {item.note && (
                  <p className="text-[11px] text-blue-800 font-medium pt-1">
                    Note: {item.note}
                  </p>
                )}
              </div>

              {!item.isRead && (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-2" />
              )}
            </div>
          ))}

          {meta.page < meta.totalPages && (
            <div className="pt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs cursor-pointer"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
                <span>Load older notifications ({meta.total - notifications.length} remaining)</span>
              </Button>
            </div>
          )}
        </div>
      )}

      <NotificationPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
      />
    </div>
  );
}
