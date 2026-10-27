import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientAppointments } from '@/lib/api/patient';
import { PatientAppointmentsClient } from '@/components/patient/PatientAppointmentsClient';
import { Calendar, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PatientAppointmentsPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  let appointments: any[] = [];
  try {
    const res = await getPatientAppointments(token);
    appointments = res.data || [];
  } catch (err) {
    console.error('Error fetching patient appointments:', err);
  }

  return (
    <div className="page-container space-y-8 py-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-800">Appointments</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">My visits</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Cancel or reschedule upcoming bookings.
          </p>
        </div>
        <Link href="/doctors" className="btn-primary text-xs">
          <Search className="h-4 w-4" />
          Book doctor
        </Link>
      </div>

      <PatientAppointmentsClient initialAppointments={appointments} />
    </div>
  );
}
