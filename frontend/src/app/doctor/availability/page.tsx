import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorAvailability } from '@/lib/api/availability';
import { getDoctorLeaves } from '@/lib/api/leave';
import { UnifiedDoctorScheduleClient } from '@/components/doctor/UnifiedDoctorScheduleClient';
import { Calendar, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface DoctorAvailabilityPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function DoctorAvailabilityPage({ searchParams }: DoctorAvailabilityPageProps) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  const params = await searchParams;
  const initialTab = (params.tab === 'leaves' || params.tab === 'overrides' || params.tab === 'unavailable')
    ? params.tab
    : 'recurring';

  let availabilities: any = [];
  try {
    const res = await getDoctorAvailability(token);
    availabilities = res?.data || [];
  } catch (err) {
    console.error('Failed to load doctor availability:', err);
  }

  let leaves: any = [];
  try {
    const leaveRes = await getDoctorLeaves(token);
    leaves = Array.isArray(leaveRes?.data) ? leaveRes.data : Array.isArray(leaveRes) ? leaveRes : [];
  } catch (err) {
    console.error('Failed to load doctor leaves:', err);
  }

  return (
    <div className="page-container py-8 sm:py-10 space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Schedule & Roster Hub
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Doctor Availability & Leave Management
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Unified command center to configure weekly clinic shifts, buffer times, custom date overrides, and official time off.
            </p>
          </div>
        </div>
      </div>

      <UnifiedDoctorScheduleClient
        initialAvailability={availabilities}
        initialLeaves={leaves}
        defaultTab={initialTab as any}
      />
    </div>
  );
}
