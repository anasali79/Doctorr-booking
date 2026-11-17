import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorAppointments, getDoctorProfile } from '@/lib/api/doctors';
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
  let doctorProfile: any = null;

  try {
    const [apptRes, profRes] = await Promise.allSettled([
      getDoctorAppointments(selectedDate, token),
      getDoctorProfile(token),
    ]);

    if (apptRes.status === 'fulfilled') {
      appointments = apptRes.value.data || [];
    }
    if (profRes.status === 'fulfilled') {
      doctorProfile = profRes.value.data || null;
    }
  } catch (err) {
    console.error('Failed to load doctor appointments or profile:', err);
  }

  return (
    <DoctorLiveQueueClient
      key={selectedDate}
      initialAppointments={appointments}
      selectedDate={selectedDate}
      todayIST={todayIST}
      doctorId={doctorProfile?.id || user.id}
    />
  );
}
