import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile, getPatientDashboard } from '@/lib/api/patient';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatTime, getTodayIST } from '@/lib/utils';
import {
  ArrowRight,
  Calendar,
  Clock,
  User,
  Activity,
  UserCheck,
  Stethoscope,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { PatientLiveQueueButton } from '@/components/patient/PatientLiveQueueButton';

export const dynamic = 'force-dynamic';

export default async function PatientDashboardPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  const [profileResult, dashboardResult] = await Promise.allSettled([
    getPatientProfile(token),
    getPatientDashboard(token),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value?.data : null;

  if (!profile) {
    redirect('/patient/profile-setup');
  }

  const dashRes: any = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const dashboardData = dashRes?.data || dashRes || { upcoming: [], past: [], liveQueue: null };

  const upcoming: any[] = dashboardData?.upcoming || [];
  const todayIST = getTodayIST();

  const activeToday = upcoming.find(
    (a: any) =>
      a.date === todayIST &&
      (a.status === 'CONFIRMED' || a.status === 'CHECKED_IN' || a.status === 'IN_CONSULTATION'),
  );

  return (
    <div className="page-container space-y-8 py-8 sm:py-10">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              Real-Time Patient Portal
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back, {profile.fullName}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Live token broadcasting, queue wait forecasts, and verified doctors appointments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/doctors" className="btn-primary text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Book New Visit
            </Link>
          </div>
        </div>
      </div>

      {/* Active Today Live Queue Card */}
      {activeToday ? (
        <div className="relative overflow-hidden rounded-3xl border border-blue-900 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 border border-blue-400/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Scheduled for Today (IST)
              </span>
              <h2 className="mt-3 text-2xl font-bold">
                {activeToday.doctor?.fullName || 'Doctor Consultation'}
              </h2>
              <p className="mt-1 text-xs text-blue-200 capitalize font-medium flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                {activeToday.doctor?.specialization} • Slot: {formatTime(activeToday.startTime)}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <StatusBadge status={activeToday.status} />
              <span className="text-[11px] text-blue-300">
                {activeToday.status === 'CONFIRMED' && 'Slot confirmed. Check in at clinic.'}
                {activeToday.status === 'CHECKED_IN' && 'Checked in! Please wait for token call.'}
                {activeToday.status === 'IN_CONSULTATION' && 'Your consultation is now active.'}
              </span>
            </div>
          </div>

          {/* Large Live Metrics */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-6 rounded-2xl bg-white/5 backdrop-blur-md p-4 sm:p-6 border border-white/10 text-center">
            <div className="space-y-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300 block">
                Your Token
              </span>
              <span className="font-mono text-3xl sm:text-5xl font-black text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]">
                {activeToday.tokenNumber ? `#${activeToday.tokenNumber}` : '—'}
              </span>
              <span className="text-[10px] text-slate-300 block">Official sequence</span>
            </div>

            <div className="space-y-1 border-x border-white/10">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300 block">
                Queue Position
              </span>
              <span className="font-mono text-3xl sm:text-5xl font-black text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                {activeToday.queuePosition ? `#${activeToday.queuePosition}` : '—'}
              </span>
              <span className="text-[10px] text-slate-300 block">Ahead in line</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-300 block">
                Estimated Wait
              </span>
              <span className="font-mono text-3xl sm:text-5xl font-black text-sky-300 drop-shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                {activeToday.estimatedWaitTime ?? 0}<span className="text-xl sm:text-2xl font-bold text-blue-200">m</span>
              </span>
              <span className="text-[10px] text-slate-300 block">Real-time estimate</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10 text-xs text-blue-200">
            <span className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
              Live Clinic Queue connection active
            </span>
            <div className="flex items-center gap-3">
              <PatientLiveQueueButton
                appointmentId={activeToday.id}
                variant="card"
                label="Track Doctor Live Queue (See who is before you)"
              />
              <Link
                href="/patient/appointments"
                className="font-semibold text-white/90 hover:text-white transition-colors flex items-center gap-1"
              >
                Manage visit <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">No consultation scheduled for today</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                When you book a visit for today, your live token and queue position will broadcast here.
              </p>
            </div>
          </div>
          <Link href="/doctors" className="btn-secondary text-xs whitespace-nowrap">
            Find an open slot
          </Link>
        </div>
      )}

      {/* Upcoming Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            Upcoming Appointments
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {upcoming.length}
            </span>
          </h2>
          <Link
            href="/patient/appointments"
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            View all appointments <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <Calendar className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800">No upcoming appointments</p>
            <p className="mt-1 text-xs text-slate-500">Search from verified specialists and pick an open slot.</p>
            <Link
              href="/doctors"
              className="btn-primary mt-5 inline-flex text-xs"
            >
              Browse Doctors Directory
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((appt: any) => (
              <article
                key={appt.id}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] hover:border-blue-300 hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-blue-800 text-sm font-bold text-white shadow-xs">
                        {appt.doctor?.fullName?.charAt(0) || 'D'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {appt.doctor?.fullName || 'Doctor'}
                        </h3>
                        <p className="truncate text-xs font-semibold capitalize text-blue-700">
                          {appt.doctor?.specialization}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="rounded-xl bg-slate-50/80 p-2.5">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Date</span>
                      <span className="font-bold text-slate-800">{formatDate(appt.date)}</span>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 p-2.5">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Time</span>
                      <span className="font-bold text-slate-800">
                        {formatTime(appt.startTime)}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/patient/appointments"
                  className="mt-4 flex items-center justify-between text-xs font-bold text-blue-700 hover:text-blue-800 border-t border-slate-100 pt-3"
                >
                  <span>Manage Appointment</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
