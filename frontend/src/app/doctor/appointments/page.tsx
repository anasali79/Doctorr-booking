import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorAppointments } from '@/lib/api/doctors';
import { DoctorLiveQueueClient } from '@/components/doctor/DoctorLiveQueueClient';
import { getTodayIST } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface DoctorAppointmentsPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DoctorAppointmentsPage({ searchParams }: DoctorAppointmentsPageProps) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  const params = await searchParams;
  const todayIST = getTodayIST();
  const selectedDate = params.date || todayIST;

  let appointments: any[] = [];
  try {
    const res = await getDoctorAppointments(selectedDate, token);
    appointments = res.data || [];
  } catch (err) {
    console.error('Failed to load doctor appointments:', err);
  }

  return (
    <DoctorLiveQueueClient
      initialAppointments={appointments}
      selectedDate={selectedDate}
      todayIST={todayIST}
    />
  );
}
