import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile, getDoctorDashboard, getDoctorAppointments } from '@/lib/api/doctors';
import { getDoctorVerificationStatus } from '@/lib/api/admin';
import { DoctorDashboardInteractive } from '@/components/doctor/DoctorDashboardInteractive';
import {
  CalendarDays,
  Clock,
  LogOut,
} from 'lucide-react';
import { getTodayIST } from '@/lib/utils';
import { Appointment } from '@/types';

export const dynamic = 'force-dynamic';

export default async function DoctorDashboardPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  const [profileResult, dashboardResult, appointmentsResult] = await Promise.allSettled([
    getDoctorProfile(token),
    getDoctorDashboard(token),
    getDoctorAppointments('', token),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value?.data : null;

  if (!profile) {
    redirect('/doctor/profile-setup');
  }

  const verificationRes = await getDoctorVerificationStatus(token).catch(() => null);
  if (verificationRes?.data?.status !== 'APPROVED') {
    redirect('/doctor/verification');
  }

  const res: any = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const resolvedData = res?.data || res;

  const allAppointments: Appointment[] =
    appointmentsResult.status === 'fulfilled'
      ? appointmentsResult.value?.data || []
      : [];

  const todayIST = getTodayIST();
  const todayAppointments: Appointment[] =
    resolvedData?.todayAppointments && resolvedData.todayAppointments.length > 0
      ? resolvedData.todayAppointments
      : allAppointments.filter((a) => a.date === todayIST);

  const stats = resolvedData?.stats || {
    today: todayAppointments.length,
    upcoming: allAppointments.filter(
      (a) => a.date >= todayIST && a.status !== 'CANCELLED',
    ).length,
    completed: allAppointments.filter((a) => a.status === 'COMPLETED').length,
    cancelled: allAppointments.filter((a) => a.status === 'CANCELLED').length,
    noShow: allAppointments.filter((a) => a.status === 'NO_SHOW').length,
    totalPatients: new Set(allAppointments.map((a) => a.patientId).filter(Boolean)).size,
  };

  const currentHourIST = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
  ).getHours();
  const greeting =
    currentHourIST < 12
      ? 'Good Morning'
      : currentHourIST < 17
        ? 'Good Afternoon'
        : 'Good Evening';

  const doctorDisplayName = profile.fullName.startsWith('Dr.')
    ? profile.fullName
    : `Dr. ${profile.fullName}`;

  return (
    <div className="page-container space-y-6 sm:space-y-8 py-4 sm:py-6">
      {/* ── Top Welcome Banner (Redesigned matching screenshot) ── */}
      <div className="relative rounded-2xl sm:rounded-3xl border border-blue-100/70 bg-gradient-to-r from-[#eef5fc] via-[#e6f1fd] to-[#edf4fc] p-6 sm:p-8 overflow-hidden shadow-[0_2px_16px_rgba(0,102,204,0.04)]">
        {/* Subtle Watermark Stethoscope SVG Illustration in Background */}
        <div className="pointer-events-none absolute right-12 sm:right-28 md:right-48 lg:right-64 top-1/2 -translate-y-1/2 opacity-25 select-none text-blue-500">
          <svg
            className="h-36 w-36 sm:h-44 sm:w-44"
            viewBox="0 0 200 200"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Left Earpiece & Tube */}
            <circle cx="68" cy="35" r="4" fill="currentColor" />
            <path d="M68 39 C 68 55, 78 70, 90 78" />
            {/* Right Earpiece & Tube */}
            <circle cx="112" cy="35" r="4" fill="currentColor" />
            <path d="M112 39 C 112 55, 102 70, 90 78" />
            {/* Tube looping down and up to chest piece */}
            <path d="M90 78 L90 92 C 90 120, 60 135, 60 155 C 60 175, 80 185, 100 185 C 125 185, 138 165, 138 140 L138 125" />
            {/* Chest Piece / Stethoscope Head */}
            <circle cx="138" cy="115" r="10" strokeWidth="5" />
            <circle cx="138" cy="115" r="4" fill="currentColor" />
          </svg>
        </div>

        {/* Banner Content */}
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm sm:text-base font-semibold text-slate-600">
              {greeting},
            </p>
            <h1 className="mt-0.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>{doctorDisplayName}</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
              Here&apos;s what&apos;s happening with your clinic today.
            </p>
          </div>

          {/* Action Pill Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Link
              href="/doctor/my-day"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl bg-[#0066cc] text-white text-xs sm:text-sm font-semibold shadow-xs hover:bg-[#0055b3] transition-all"
            >
              <CalendarDays className="w-4 h-4" />
              <span>My Day</span>
            </Link>

            <Link
              href="/doctor/availability"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl bg-white/95 hover:bg-white text-slate-800 text-xs sm:text-sm font-semibold shadow-2xs hover:shadow-xs transition-all border border-slate-200/60"
            >
              <Clock className="w-4 h-4 text-slate-700" />
              <span>Availability</span>
            </Link>

            <Link
              href="/doctor/availability?tab=leaves"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl bg-white/95 hover:bg-white text-slate-800 text-xs sm:text-sm font-semibold shadow-2xs hover:shadow-xs transition-all border border-slate-200/60"
            >
              <LogOut className="w-4 h-4 text-slate-700" />
              <span>Leave</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Interactive 4 Clickable Cards & All Appointments (Matching Reference Image) ── */}
      <DoctorDashboardInteractive
        stats={stats}
        initialAppointments={todayAppointments}
        initialAllAppointments={allAppointments}
        doctorId={profile.id}
      />
    </div>
  );
}
