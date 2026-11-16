import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile, getPatientAppointments } from '@/lib/api/patient';
import { formatDate, formatTime, getTodayIST } from '@/lib/utils';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';
import { PatientLiveQueueButton } from '@/components/patient/PatientLiveQueueButton';
import { PatientDashboardSearch } from '@/components/patient/PatientDashboardSearch';
import {
  Calendar,
  Clock,
  Stethoscope,
  FileText,
  Phone,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Building2,
  HeartPulse,
  Pill,
  Ban,
  Bell,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PatientDashboardPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  const [profileResult, apptsResult] = await Promise.allSettled([
    getPatientProfile(token),
    getPatientAppointments(token),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value?.data : null;

  if (!profile) {
    redirect('/patient/profile-setup');
  }

  const apptsRes: any = apptsResult.status === 'fulfilled' ? apptsResult.value : null;
  const rawAppointments: any[] = apptsRes?.data || [];

  // De-duplicate appointments by id
  const apptMap = new Map<string, any>();
  rawAppointments.forEach((a) => {
    if (a && a.id) apptMap.set(a.id, a);
  });
  const appointments = Array.from(apptMap.values());

  const todayStr = getTodayIST();
  const now = new Date();
  const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();
  const nowMs = Date.now();

  const toMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const [hh, mm] = timeStr.split(':').map((v) => parseInt(v, 10));
    return (isNaN(hh) ? 0 : hh) * 60 + (isNaN(mm) ? 0 : mm);
  };

  const isSlotPastToday = (a: any) => {
    if (!a.date) return false;
    if (a.date < todayStr) return true;
    if (a.date === todayStr && a.status === 'CONFIRMED') {
      const slotEnd = a.endTime ? toMinutes(a.endTime) : toMinutes(a.startTime) + 30;
      return slotEnd < currentMinutes;
    }
    return false;
  };

  // Pending reservations (held for 15 minutes)
  const pendingReservations = appointments.filter(
    (a: any) =>
      a.status === 'PENDING_PAYMENT' &&
      a.pendingExpiresAt &&
      new Date(a.pendingExpiresAt).getTime() > nowMs,
  );

  // Real Upcoming / Active Appointments
  const upcoming = appointments
    .filter(
      (a: any) =>
        ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status) &&
        !isSlotPastToday(a),
    )
    .sort((a: any, b: any) => {
      const dComp = (a.date || '').localeCompare(b.date || '');
      if (dComp !== 0) return dComp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

  // Real Past / Completed / Cancelled Consultations
  const past = appointments
    .filter(
      (a: any) =>
        ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'].includes(a.status) ||
        (['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status) && isSlotPastToday(a)),
    )
    .sort((a: any, b: any) => {
      const dComp = (b.date || '').localeCompare(a.date || '');
      if (dComp !== 0) return dComp;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });

  const nextVisit = upcoming[0];
  const isNextVisitToday = nextVisit?.date === todayStr;

  // Patient display details
  const firstName = profile.fullName ? profile.fullName.split(' ')[0] : 'there';

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] pb-16 pt-4 text-slate-800">
      {/* ═══════════════ SUBTLE BACKGROUND WATERMARK ═══════════════ */}
      <div className="pointer-events-none fixed -bottom-10 -left-10 -z-10 select-none overflow-hidden opacity-30">
        <svg width="280" height="280" viewBox="0 0 280 280" fill="none">
          <path
            d="M-20 200 C40 200, 80 240, 80 300 L-20 300 Z"
            fill="rgba(191, 219, 254, 0.4)"
          />
          <path
            d="M20 180 C80 180, 120 220, 140 280"
            stroke="rgba(147, 197, 253, 0.35)"
            strokeWidth="30"
            strokeLinecap="round"
          />
          <g transform="translate(60, 210)">
            <rect x="-6" y="-18" width="12" height="36" rx="6" fill="#93C5FD" opacity="0.6" />
            <rect x="-18" y="-6" width="36" height="12" rx="6" fill="#93C5FD" opacity="0.6" />
          </g>
        </svg>
      </div>


      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        {/* ═══════════════ 1. TOP QUICK SEARCH BAR (NO DUPLICATE ICONS) ═══════════════ */}
        <div className="w-full max-w-md pt-1">
          <PatientDashboardSearch />
        </div>

        {/* ═══════════════ ACTION REQUIRED: PENDING RESERVATION ═══════════════ */}
        {pendingReservations.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 sm:p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900 mt-0.5">
                <Clock className="h-5 w-5 animate-spin" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                  Slot Reserved (15 Min Hold)
                </span>
                <p className="text-xs sm:text-sm font-bold text-amber-950 mt-1">
                  You have an unconfirmed consultation slot with Dr.{' '}
                  {pendingReservations[0].doctor?.fullName || 'Doctor'} on{' '}
                  {formatDate(pendingReservations[0].date)} at{' '}
                  {formatTime(pendingReservations[0].startTime)}.
                </p>
                <p className="text-[11px] text-amber-800">
                  Complete payment before it expires to secure your confirmed token.
                </p>
              </div>
            </div>
            <Link
              href="/patient/appointments"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
            >
              <span>Pay &amp; Confirm</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* ═══════════════ 2. WELCOME HERO BANNER ═══════════════ */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-blue-100 bg-gradient-to-r from-[#EFF6FF] via-[#E8F3FF] to-[#DCEEFF] p-6 sm:p-8 shadow-xs">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                <span>Welcome back, {firstName}</span>
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 font-medium">
                Here&apos;s what&apos;s happening with your health
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/doctors"
                className="inline-flex items-center gap-2.5 rounded-xl sm:rounded-2xl bg-[#0066cc] px-5 py-3 text-xs sm:text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0052a3] hover:shadow-lg hover:scale-[1.01]"
              >
                <Calendar className="h-4 w-4" />
                <span>Book New Appointment</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Stethoscope & Medical Cross Illustration (Right Side) */}
          <div className="pointer-events-none absolute -right-4 -bottom-6 top-0 hidden md:flex items-center justify-end select-none overflow-hidden opacity-90">
            <svg
              viewBox="0 0 240 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-56 lg:w-64 h-auto"
            >
              {/* Soft Radial Ambient Glow */}
              <circle cx="160" cy="80" r="70" fill="url(#hero-glow)" />
              <path
                d="M60 160 C120 160, 180 130, 240 60 L240 160 Z"
                fill="rgba(191, 219, 254, 0.45)"
              />
              <defs>
                <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Medical Plus Cross (+) */}
              <g transform="translate(195, 62)">
                <rect x="-4" y="-12" width="8" height="24" rx="4" fill="#60A5FA" opacity="0.8" />
                <rect x="-12" y="-4" width="24" height="8" rx="4" fill="#60A5FA" opacity="0.8" />
              </g>

              {/* Stethoscope Tubing & Earpieces */}
              <g
                stroke="#3B82F6"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              >
                <path d="M75 25 C75 45, 95 68, 115 68 C135 68, 155 45, 155 25" />
                <path d="M115 68 L115 85" />
                <path d="M115 85 C115 120, 180 130, 180 95 C180 82, 165 76, 152 79" />
              </g>
              {/* Stethoscope Chestpiece */}
              <circle cx="147" cy="80" r="8" fill="#DBEAFE" stroke="#2563EB" strokeWidth="4" />
            </svg>
          </div>
        </section>

        {/* ═══════════════ 3. QUICK STAT / KPI CARDS (2 COLUMNS - REAL DATA) ═══════════════ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Card 1: Upcoming Appointments */}
          <Link
            href="/patient/appointments"
            className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs transition-all hover:border-blue-300 hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc] shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {upcoming.length}
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                  Upcoming Appointments
                </div>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#0066cc] transition-colors">
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Card 2: Consultation History */}
          <Link
            href="/patient/appointments"
            className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {past.length}
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                  Consultation History
                </div>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </div>
          </Link>
        </section>

        {/* ═══════════════ 4. UPCOMING CONSULTATION SECTION (REAL DATA) ═══════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center text-[#0066cc]">
                <Calendar className="h-4 w-4" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Upcoming Consultation ({upcoming.length})
              </h2>
            </div>
            {upcoming.length > 0 && (
              <Link
                href="/patient/appointments"
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#0066cc] hover:underline"
              >
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {nextVisit ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all hover:shadow-sm">
              {/* Doctor Info */}
              <div className="flex items-center gap-3.5">
                <DoctorAvatar
                  name={nextVisit.doctor?.fullName || 'Doctor'}
                  size="md"
                  className="rounded-full ring-2 ring-blue-100"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      Dr. {nextVisit.doctor?.fullName || 'Doctor'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isNextVisitToday
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-blue-100 bg-blue-50 text-blue-600'
                        }`}
                    >
                      {isNextVisitToday ? 'Today' : 'Upcoming'}
                    </span>
                    {nextVisit.tokenNumber && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        Token #{String(nextVisit.tokenNumber).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {nextVisit.doctor?.specialization || 'General Physician'}
                  </p>
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>
                  {isNextVisitToday ? 'Today' : formatDate(nextVisit.date)} •{' '}
                  {formatTime(nextVisit.startTime)}
                  {nextVisit.endTime ? ` – ${formatTime(nextVisit.endTime)}` : ''}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isNextVisitToday ? (
                  <PatientLiveQueueButton
                    appointmentId={nextVisit.id}
                    variant="primary"
                    label="Live Queue"
                  />
                ) : null}

                <Link
                  href="/patient/appointments"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200/90 bg-white px-5 py-2 text-xs sm:text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
                >
                  View Details
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc] shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  No Upcoming Consultations
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  You do not have any active appointments scheduled. Book a certified doctor anytime.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════ 5. PATIENT HEALTH ACTIONS ═══════════════ */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-[#0066cc]" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Patient Health Actions
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Action 1: Book a Doctor */}
            <Link
              href="/doctors"
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-all hover:border-blue-300 hover:shadow-sm"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0066cc]">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900 transition-colors group-hover:text-[#0066cc]">
                  Book a Doctor
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Select a general physician or specialist &amp; slot
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#0066cc] transition-colors group-hover:bg-[#0066cc] group-hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            {/* Action 2: My Appointments */}
            <Link
              href="/patient/appointments"
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-all hover:border-purple-300 hover:shadow-sm"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900 transition-colors group-hover:text-purple-600">
                  My Appointments
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  View scheduled visits, live queue &amp; reschedule
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            {/* Action 3: Medical Notes */}
            <Link
              href="/patient/profile"
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900 transition-colors group-hover:text-emerald-600">
                  Medical Notes
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Update basic health history, allergies &amp; contact
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            {/* Action 4: Alerts & Inbox */}
            <Link
              href="/patient/notifications"
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-all hover:border-amber-300 hover:shadow-sm"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Bell className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900 transition-colors group-hover:text-amber-600">
                  Alerts &amp; Inbox
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Consultation reminders &amp; live token alerts
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* ═══════════════ 6. MEDICAL RECORD & HEALTH NOTES ═══════════════ */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0066cc]" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Medical Record &amp; Health Notes
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Your real clinical summary, allergies, and doctor consultation notes
              </p>
            </div>
            <Link
              href="/patient/profile"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-[#0066cc] hover:underline"
            >
              <span>Edit Medical Profile</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {/* Column 1: Health Summary */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Health Summary
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Registered Patient</span>
                  <span className="font-bold text-slate-900">{profile.fullName || 'rahul'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Age</span>
                  <span className="font-bold text-slate-900">
                    {profile.age || "NA"} • {profile.gender === 'FEMALE' ? 'Female' : 'Male'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Blood Group</span>
                  <span className="font-bold text-slate-900">
                    {profile.bloodGroup || 'Not specified'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Primary Contact</span>
                  <span className="font-bold text-slate-900">
                    {profile.phone || (profile as any).contactDetails?.phone || (user as any)?.phone || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Allergies & Meds */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Allergies &amp; Meds
              </h3>
              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <Ban className="h-3.5 w-3.5 text-red-500" />
                    <span>Known Allergies</span>
                  </div>
                  <p className="mt-0.5 text-slate-500 text-[11px] pl-5">
                    {profile.allergies?.trim() || 'No known allergies reported'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    <span>Medical History &amp; Conditions</span>
                  </div>
                  <p className="mt-0.5 text-slate-500 text-[11px] pl-5">
                    {profile.medicalHistory?.trim() || 'No chronic conditions recorded'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <Pill className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Current Medications</span>
                  </div>
                  <p className="mt-0.5 text-slate-500 text-[11px] pl-5">
                    {profile.currentMedication?.trim() || 'No active medications recorded'}
                  </p>
                </div>
              </div>
            </div>

            {/* Column 3: Doctor Notes */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                  <FileText className="h-4 w-4 text-[#0066cc]" />
                  <span>Doctor Notes</span>
                </div>

                <div className="py-6 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    No clinical notes recorded yet
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Clinical advice recorded by your doctor during visits will appear here.
                  </p>
                </div>
              </div>

              <Link
                href="/patient/profile"
                className="w-full rounded-xl bg-blue-50 py-2.5 text-center text-xs font-semibold text-[#0066cc] transition-colors hover:bg-blue-100 block"
              >
                Update Medical Information
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════ 7. RECENT CONSULTATIONS & CLINIC SUPPORT (REAL DATA) ═══════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Consultations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Recent Consultations ({past.length})
                </h3>
              </div>
              {past.length > 0 && (
                <Link
                  href="/patient/appointments"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0066cc] hover:underline"
                >
                  <span>Full History</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-2.5">
              {past.length > 0 ? (
                past.slice(0, 3).map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl p-2.5 sm:p-3 transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                        Dr. {item.doctor?.fullName || 'Doctor'}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {formatDate(item.date)} • {formatTime(item.startTime)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.status === 'CANCELLED'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-50 text-amber-700'
                          }`}
                      >
                        {item.status}
                      </span>

                      <Link
                        href={item.doctor?.id ? `/doctors/${item.doctor.id}` : '/doctors'}
                        className="rounded-lg border border-slate-200/90 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0066cc] hover:text-[#0066cc]"
                      >
                        Book Again
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400">
                  <p className="text-xs text-slate-500">No previous consultations on record.</p>
                  <Link
                    href="/doctors"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0066cc] hover:underline"
                  >
                    <span>Browse Doctors</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Clinic & Healthcare Support */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0066cc]" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Clinic &amp; Healthcare Support
              </h3>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  CareUp Medical Clinic
                </span>
                <p className="text-xs text-slate-600 mt-0.5">
                  Consultation Suites • Main Clinic Wing
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Appointments, Patient Triage &amp; Live Token Queue
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Reception Desk */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0066cc]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      RECEPTION DESK
                    </span>
                    <a
                      href="tel:01314960280"
                      className="text-xs sm:text-sm font-bold text-[#0066cc] hover:underline block mt-0.5"
                    >
                      0131 496 0280
                    </a>
                  </div>
                </div>

                {/* Clinic Hours */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0066cc]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      CLINIC HOURS
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 block mt-0.5">
                      Mon-Fri: 08:00 – 18:30
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
