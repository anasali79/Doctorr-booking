import React, { Suspense } from 'react';
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
    const data = res?.data || res || [];
    initialPatients = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to fetch doctor patients directory:', err);
    initialPatients = [];
  }

  return (
    <div className="page-container py-8 sm:py-10">
      <Suspense
        fallback={
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin h-8 w-8 border-2 border-[#0066cc] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-700">Loading Patients Directory…</p>
          </div>
        }
      >
        <DoctorPatientsClient initialPatients={initialPatients} />
      </Suspense>
    </div>
  );
}
