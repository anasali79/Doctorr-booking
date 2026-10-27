import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getNotifications } from '@/lib/api/notifications';
import { PatientNotificationsClient } from '@/components/patient/PatientNotificationsClient';

export const dynamic = 'force-dynamic';

export default async function PatientNotificationsPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  let notifications: any[] = [];
  try {
    const res = await getNotifications(token);
    notifications = res.data || [];
  } catch (err) {
    console.error('Error fetching notifications:', err);
  }

  return (
    <div className="page-container py-8 sm:py-10 space-y-8">
      <div className="pb-6 border-b border-slate-200/80">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Patient Portal
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Notifications & Live Queue Alerts
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Stay updated on your consultation queue position, wait times, and appointment status changes.
        </p>
      </div>

      <PatientNotificationsClient initialNotifications={notifications} />
    </div>
  );
}
