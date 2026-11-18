import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getReceptionistQueue } from '@/lib/api/receptionist';
import { ReceptionistLiveQueueClient } from '@/components/receptionist/ReceptionistLiveQueueClient';
import { getTodayIST } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface ReceptionistQueuePageProps {
  searchParams: Promise<{ date?: string; doctorId?: string }>;
}

export default async function ReceptionistQueuePage({
  searchParams,
}: ReceptionistQueuePageProps) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'RECEPTIONIST' || !token) {
    redirect('/login');
  }

  const params = await searchParams;
  const todayIST = getTodayIST();
  const selectedDate = params.date || todayIST;
  const requestedDoctorId = params.doctorId;

  let appointments: any[] = [];
  let doctor: any = null;
  let allDoctors: any[] = [];
  let yesterdayStats: { total: number; completed: number } | null = null;

  try {
    const res = await getReceptionistQueue(selectedDate, requestedDoctorId, token);
    appointments = res.data || [];
    doctor = res.doctor || null;
    allDoctors = res.allDoctors || [];
    yesterdayStats = res.yesterdayStats || null;
  } catch (err) {
    console.error('Failed to load receptionist queue:', err);
  }

  return (
    <ReceptionistLiveQueueClient
      initialAppointments={appointments}
      doctor={doctor}
      allDoctors={allDoctors}
      selectedDoctorId={requestedDoctorId || doctor?.id}
      selectedDate={selectedDate}
      todayIST={todayIST}
      initialYesterdayStats={yesterdayStats}
    />
  );
}
