'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationItem } from '@/types';
import { formatDate } from '@/lib/utils';
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
  AlertCircle,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DoctorNotificationsClientProps {
  initialNotifications: NotificationItem[];
}

export function DoctorNotificationsClient({
  initialNotifications,
}: DoctorNotificationsClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await clientAxios.patch('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification_updated'));
      }
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification_updated'));
      }
      router.refresh();
    } catch {
      // Best effort
    } finally {
      setMarkingId(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
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
          <Button type="button" variant="ghost" onClick={() => setFilter('ALL')} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'ALL'
                ? 'bg-[#0066cc] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            } h-auto`}>All Alerts ({notifications.length})</Button>
          <Button type="button" variant="ghost" onClick={() => setFilter('UNREAD')} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === 'UNREAD'
                ? 'bg-[#0066cc] text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            } h-auto`}>Unread ({unreadCount})</Button>
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="rounded-xl text-xs font-semibold gap-1.5 self-start sm:self-auto border-slate-200 hover:bg-slate-50"
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5 text-[#0066cc]" />
            )}
            <span>Mark all as read</span>
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {filteredList.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {filter === 'UNREAD' ? 'No unread alerts' : 'No notifications yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {filter === 'UNREAD'
              ? 'You have caught up with all your clinical notifications.'
              : 'You will receive real-time alerts whenever patients book, cancel, or check in for appointments.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const isUnread = !item.isRead;
            return (
              <Card
                key={item.id}
                className={`rounded-2xl border transition-all p-4 sm:p-5 flex items-start gap-4 ${
                  isUnread
                    ? 'border-blue-200 bg-blue-50/30 shadow-xs'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                {getNotificationIcon(item.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`text-sm font-bold ${
                          isUnread ? 'text-slate-950 font-black' : 'text-slate-800'
                        }`}
                      >
                        {item.title}
                      </h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#0066cc]" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                      {item.createdAt}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  {item.note && (
                    <div className="mt-2">
                      <span className="inline-block text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        Note: {item.note}
                      </span>
                    </div>
                  )}

                  {isUnread && (
                    <div className="mt-3 flex items-center justify-end">
                      <Button type="button" variant="link" size="xs" onClick={() => handleMarkSingleRead(item.id)} disabled={markingId === item.id} className="text-[11px] font-semibold text-[#0066cc] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 p-0 h-auto">
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
        </div>
      )}
    </div>
  );
}

