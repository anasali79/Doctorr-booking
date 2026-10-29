import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getNotifications } from '@/lib/api/notifications';
import { DoctorNotificationsClient } from '@/components/doctor/DoctorNotificationsClient';

export const dynamic = 'force-dynamic';

export default async function DoctorNotificationsPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login?next=/doctor/notifications');
  }

  let notifications: any[] = [];
  try {
    const res = await getNotifications(token);
    notifications = res.data || [];
  } catch (err) {
    console.error('Error fetching doctor notifications:', err);
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
              Clinical Alerts
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Doctor Notifications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time notifications for patient bookings, cancellations, check-ins, and schedule updates.
          </p>
        </div>
      </div>

      <DoctorNotificationsClient initialNotifications={notifications} />
    </div>
  );
}

