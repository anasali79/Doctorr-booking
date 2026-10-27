import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile, getDoctorDashboard, getDoctorAppointments } from '@/lib/api/doctors';
import { MyDayClient } from '@/components/doctor/MyDayClient';
import { getTodayIST } from '@/lib/utils';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "My Day — Doctor Portal",
  description: "Your complete daily command center with today's appointments, patient queue, and schedule overview.",
};

export default async function MyDayPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  const todayIST = getTodayIST();

  const [profileResult, dashboardResult, appointmentsResult] = await Promise.allSettled([
    getDoctorProfile(token),
    getDoctorDashboard(token),
    getDoctorAppointments(todayIST, token),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value?.data : null;

  if (!profile) {
    redirect('/doctor/profile-setup');
  }

  const dashData: any = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const resolved = dashData?.data || dashData;
  const stats = resolved?.stats || {
    today: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    totalPatients: 0,
  };

  const appointments =
    appointmentsResult.status === 'fulfilled'
      ? appointmentsResult.value?.data || []
      : resolved?.todayAppointments || [];

  return (
    <MyDayClient
      profile={profile}
      appointments={appointments}
      stats={stats}
      today={todayIST}
      doctorName={profile.fullName}
    />
  );
}
