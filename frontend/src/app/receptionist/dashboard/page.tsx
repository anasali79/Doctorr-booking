import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getReceptionistAppointments } from '@/lib/api/receptionist';
import { ReceptionistAppointmentsClient } from '@/components/receptionist/ReceptionistAppointmentsClient';
import { getTodayIST } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReceptionistDashboardPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'RECEPTIONIST' || !token) {
    redirect('/login');
  }

  const todayIST = getTodayIST();
  let appointments: any[] = [];
  let doctor: any = null;

  try {
    const res = await getReceptionistAppointments(token);
    appointments = res.data || [];
    doctor = res.doctor || null;
  } catch (err) {
    console.error('Failed to load receptionist appointments:', err);
  }

  return (
    <ReceptionistAppointmentsClient
      initialAppointments={appointments}
      doctor={doctor}
      todayIST={todayIST}
    />
  );
}
