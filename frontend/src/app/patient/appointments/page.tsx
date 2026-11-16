import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientAppointments } from '@/lib/api/patient';
import { PatientAppointmentsClient } from '@/components/patient/PatientAppointmentsClient';
import { Calendar, Search, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PatientAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  const resolvedParams = await searchParams;
  const initialTab =
    resolvedParams?.tab?.toUpperCase() === 'PAST' ? 'PAST' : 'UPCOMING';

  let appointments: any[] = [];
  try {
    const res = await getPatientAppointments(token);
    appointments = res.data || [];
  } catch (err) {
    console.error('Error fetching patient appointments:', err);
  }

  return (
    <div className="flex-1 w-full bg-[#F8FAFC]">
      <div className="page-container space-y-8 py-8 sm:py-12">
        <div className="flex flex-col justify-between gap-4 border-b border-black/[0.06] pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-950">My visits</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Monitor live queue tokens, cancel or reschedule upcoming outpatient appointments.
            </p>
          </div>
          <Link href="/doctors" className="btn-primary text-xs">
            <Search className="h-4 w-4" />
            Book doctor
          </Link>
        </div>

        <PatientAppointmentsClient
          initialAppointments={appointments}
          initialTab={initialTab}
        />
      </div>
    </div>
  );
}
