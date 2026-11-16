'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationItem } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Bell,
  CheckCheck,
  Inbox,
  Loader2,
  CalendarCheck,
  XCircle,
  Clock,
  UserCheck,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NotificationPreferencesDialog } from '@/components/common/NotificationPreferencesDialog';

interface MetaData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DoctorNotificationsClientProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount?: number;
  initialMeta?: MetaData;
}

export function DoctorNotificationsClient({
  initialNotifications,
  initialUnreadCount,
  initialMeta = { total: initialNotifications.length, page: 1, limit: 20, totalPages: 1 },
}: DoctorNotificationsClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(
    initialUnreadCount !== undefined
      ? initialUnreadCount
      : initialNotifications.filter((n) => !n.isRead).length
  );
  const [meta, setMeta] = useState<MetaData>(initialMeta);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
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
      setMarkingId(id);
      await clientAxios.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      notifyChange();
      router.refresh();
    } catch {
      // Best effort
    } finally {
      setMarkingId(null);
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

  const filteredList =
    filter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'APPOINTMENT_BOOKED':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CalendarCheck className="w-5 h-5" />
          </div>
        );
      case 'APPOINTMENT_CANCELLED':
        return (
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <XCircle className="w-5 h-5" />
          </div>
        );
      case 'APPOINTMENT_RESCHEDULED':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Clock className="w-5 h-5" />
          </div>
        );
      case 'CHECK_IN_REQUEST':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0 border border-blue-100">
            <UserCheck className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
            <Bell className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === 'ALL'
                ? 'bg-[#0066cc] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            } h-auto`}
          >
            All Alerts ({meta.total || notifications.length})
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFilter('UNREAD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filter === 'UNREAD'
                ? 'bg-[#0066cc] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            } h-auto`}
          >
            Unread ({unreadCount})
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {meta.total > 0 && (
            <span className="text-xs text-slate-400 font-medium hidden md:inline">
              Showing {notifications.length} of {meta.total}
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreferencesOpen(true)}
            className="rounded-xl text-xs font-semibold gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 h-auto py-1.5 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>Preferences</span>
          </Button>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="rounded-xl text-xs font-semibold gap-1.5 border-slate-200 hover:bg-slate-50 text-slate-700 h-auto py-1.5 cursor-pointer"
            >
              {markingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Mark all read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {filteredList.length === 0 ? (
        <Card className="p-12 text-center rounded-3xl border border-slate-200/80 bg-white space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No Notifications
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filter === 'UNREAD'
              ? 'You have caught up with all your clinical notifications.'
              : 'You do not have any notifications in your inbox at this time.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            return (
              <Card
                key={item.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  item.isRead
                    ? 'border-slate-200/80 bg-white/80'
                    : 'border-blue-200 bg-blue-50/20 shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-4">
                  {getNotificationIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {item.title}
                      </h4>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {item.message}
                    </p>
                    {item.note && (
                      <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {item.note}
                      </p>
                    )}
                  </div>

                  {!item.isRead && (
                    <div className="shrink-0 self-center">
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() => handleMarkSingleRead(item.id)}
                        disabled={markingId === item.id}
                        className="text-[11px] font-semibold text-[#0066cc] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 p-0 h-auto"
                      >
                        {markingId === item.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCheck className="w-3 h-3" />
                        )}
                        Mark as read
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {/* Load More Pagination */}
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
                  <Loader2 className="w-4 h-4 animate-spin text-[#0066cc]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  Load older notifications ({meta.total - notifications.length} remaining)
                </span>
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
