import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getReceptionistAppointments } from '@/lib/api/receptionist';
import { ReceptionistAppointmentsClient } from '@/components/receptionist/ReceptionistAppointmentsClient';
import { getTodayIST } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface ReceptionistAppointmentsPageProps {
  searchParams: Promise<{ doctorId?: string }>;
}

export default async function ReceptionistAppointmentsPage({
  searchParams,
}: ReceptionistAppointmentsPageProps) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'RECEPTIONIST' || !token) {
    redirect('/login');
  }

  const params = await searchParams;
  const requestedDoctorId = params.doctorId;
  const todayIST = getTodayIST();
  let appointments: any[] = [];
  let doctor: any = null;
  let allDoctors: any[] = [];

  try {
    const res = await getReceptionistAppointments(requestedDoctorId, token);
    appointments = res.data || [];
    doctor = res.doctor || null;
    allDoctors = res.allDoctors || [];
  } catch (err) {
    console.error('Failed to load receptionist appointments:', err);
  }

  return (
    <ReceptionistAppointmentsClient
      initialAppointments={appointments}
      doctor={doctor}
      allDoctors={allDoctors}
      selectedDoctorId={requestedDoctorId || 'all'}
      todayIST={todayIST}
    />
  );
}
