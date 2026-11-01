import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorPatientsDirectory } from '@/lib/api/doctors';
import { DoctorPatientsClient } from '@/components/doctor/DoctorPatientsClient';

export const dynamic = 'force-dynamic';

export default async function DoctorPatientsPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login?next=/doctor/patients');
  }

  let initialPatients: any[] = [];
  try {
    const res = await getDoctorPatientsDirectory('', token);
    initialPatients = res.data || [];
  } catch (err) {
    console.error('Failed to fetch doctor patients directory:', err);
  }

  return (
    <div className="page-container py-8 sm:py-10">
      <DoctorPatientsClient initialPatients={initialPatients} />
    </div>
  );
}
