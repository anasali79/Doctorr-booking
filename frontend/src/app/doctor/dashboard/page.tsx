import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile, getDoctorDashboard, getDoctorAppointments } from '@/lib/api/doctors';
import { DoctorAppointmentsTable } from '@/components/doctor/DoctorAppointmentsTable';
import {
  CalendarDays,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  XCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { formatDate, getTodayIST } from '@/lib/utils';
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

  const statCards = [
    {
      label: "Today's Consults",
      value: stats.today,
      icon: Clock,
    },
    {
      label: 'Upcoming Visits',
      value: stats.upcoming,
      icon: Calendar,
    },
    {
      label: 'Completed Visits',
      value: stats.completed,
      icon: CheckCircle2,
    },
    {
      label: 'Total Patients',
      value: stats.totalPatients,
      icon: Users,
    },
    {
      label: 'Cancelled',
      value: stats.cancelled,
      icon: XCircle,
    },
    {
      label: 'No Shows',
      value: stats.noShow,
      icon: AlertCircle,
    },
  ];

  return (
    <div className="page-container space-y-8 py-8 sm:py-12">
      {/* Header Banner */}
      <div className="relative rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs overflow-hidden">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0066cc]" />
              <span>CAREUP CLINICIAN CONSOLE</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {profile.fullName}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              {profile.specialization} • {profile.qualification} • Fee: ₹{profile.consultationFee}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/doctor/my-day" className="btn-primary text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              My Day
            </Link>
            <Link href="/doctor/availability" className="btn-secondary text-xs">
              Availability
            </Link>
            <Link href="/doctor/availability?tab=leaves" className="btn-secondary text-xs">
              Leave
            </Link>
            <Link href="/doctor/appointments" className="btn-secondary text-xs">
              Patient Log
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 transition-all hover:border-slate-300 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 block truncate">
                {item.label}
              </span>
              <div className="p-1.5 rounded-lg bg-[#e8f2fe] text-[#0066cc]">
                <item.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Appointments & Live Queue Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e8f2fe] text-[#0066cc]">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                Doctor Appointments & Consultation Queue
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {formatDate(todayIST)} • Outpatient & Online Bookings
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/doctor/my-day"
              className="btn-primary !py-1.5 !px-3.5 text-xs inline-flex items-center gap-1.5"
            >
              <span>Launch Live Cabin Queue</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <DoctorAppointmentsTable
          appointments={todayAppointments}
          allAppointments={allAppointments}
          isTodayOnly={false}
        />
      </section>
    </div>
  );
}
