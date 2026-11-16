import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorAvailability } from '@/lib/api/availability';
import { getDoctorLeaves } from '@/lib/api/leave';
import { UnifiedDoctorScheduleClient } from '@/components/doctor/UnifiedDoctorScheduleClient';

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
  const initialTab = (params.tab === 'leaves' || params.tab === 'overrides' || params.tab === 'unavailable' || params.tab === 'occupancy' || params.tab === 'rescheduling')
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
    <div className="page-container py-6 sm:py-8 space-y-6 sm:space-y-8">
      <UnifiedDoctorScheduleClient
        initialAvailability={availabilities}
        initialLeaves={leaves}
        defaultTab={initialTab as any}
        doctorId={(availabilities as any)?.doctorId || user.id}
      />
    </div>
  );
}
