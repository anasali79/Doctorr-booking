import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile, getDoctorDashboard } from '@/lib/api/doctors';
import { DoctorAppointmentsTable } from '@/components/doctor/DoctorAppointmentsTable';
import {
  CalendarDays,
  ArrowRight,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  XCircle,
  AlertCircle,
  Stethoscope,
  Activity,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { formatDate, getTodayIST } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DoctorDashboardPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  const [profileResult, dashboardResult] = await Promise.allSettled([
    getDoctorProfile(token),
    getDoctorDashboard(token),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value?.data : null;

  if (!profile) {
    redirect('/doctor/profile-setup');
  }

  const res: any = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const resolvedData = res?.data || res;
  const stats = resolvedData?.stats || {
    today: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    totalPatients: 0,
  };
  const todayAppointments = resolvedData?.todayAppointments || [];

  const todayIST = getTodayIST();

  const statCards = [
    {
      label: "Today's Consults",
      value: stats.today,
      icon: Clock,
      color: 'text-blue-700 bg-blue-50 border-blue-200/60',
    },
    {
      label: 'Upcoming Scheduled',
      value: stats.upcoming,
      icon: Calendar,
      color: 'text-sky-700 bg-sky-50 border-sky-200/60',
    },
    {
      label: 'Completed Visits',
      value: stats.completed,
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
    },
    {
      label: 'Unique Patients',
      value: stats.totalPatients,
      icon: Users,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200/60',
    },
    {
      label: 'Cancelled',
      value: stats.cancelled,
      icon: XCircle,
      color: 'text-rose-700 bg-rose-50 border-rose-200/60',
    },
    {
      label: 'No Shows',
      value: stats.noShow,
      icon: AlertCircle,
      color: 'text-amber-700 bg-amber-50 border-amber-200/60',
    },
  ];

  return (
    <div className="page-container space-y-8 py-8 sm:py-10">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              Clinic Command Center
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
              Availability &amp; Shifts
            </Link>
            <Link href="/doctor/availability?tab=leaves" className="btn-secondary text-xs">
              Leave Calendar
            </Link>
            <Link href="/doctor/appointments" className="btn-secondary text-xs">
              Full Patient Log
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 block truncate">
                {item.label}
              </span>
              <div className={`p-1.5 rounded-xl border ${item.color}`}>
                <item.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900 font-mono">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Real-time Today's Queue Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                Today&apos;s Live Patient Queue ({todayAppointments.length})
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {formatDate(todayIST)} • Outpatient Roster
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-blue-800 font-bold bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200/60 shadow-2xs">
              <Activity className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
              Socket.IO Live Queue Connected
            </span>
          </div>
        </div>

        <DoctorAppointmentsTable appointments={todayAppointments} isTodayOnly={true} />
      </section>
    </div>
  );
}
