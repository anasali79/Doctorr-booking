import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile, getPatientDashboard, getPatientAppointments } from '@/lib/api/patient';
import { getUnreadCount } from '@/lib/api/notifications';
import { formatDate, formatTime, getTodayIST } from '@/lib/utils';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';
import { PatientLiveQueueButton } from '@/components/patient/PatientLiveQueueButton';
import {
  Calendar,
  Clock,
  Stethoscope,
  FileText,
  Bell,
  Phone,
  MapPin,
  User,
  PlusCircle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Building2,
  Sparkles,
  HeartPulse,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PatientDashboardPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  const [profileResult, dashboardResult, apptsResult, notifResult] = await Promise.allSettled([
    getPatientProfile(token),
    getPatientDashboard(token),
    getPatientAppointments(token),
    getUnreadCount(token),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value?.data : null;

  if (!profile) {
    redirect('/patient/profile-setup');
  }

  const dashRes: any = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  const dashboardData = dashRes?.data || dashRes || {};
  const apptsRes: any = apptsResult.status === 'fulfilled' ? apptsResult.value : null;
  const apptsList: any[] = apptsRes?.data || apptsRes || [];
  const unreadCount: number = notifResult.status === 'fulfilled' ? notifResult.value?.unreadCount || 0 : 0;

  const rawAppointments: any[] = [
    ...(dashboardData?.upcoming || []),
    ...(dashboardData?.past || []),
    ...(Array.isArray(apptsList) ? apptsList : []),
  ];

  // De-duplicate by id
  const apptMap = new Map<string, any>();
  rawAppointments.forEach((a) => {
    if (a && a.id) apptMap.set(a.id, a);
  });
  const allAppointments = Array.from(apptMap.values());

  const todayIST = getTodayIST();
  const now = new Date();
  const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

  // Helper to determine if an un-attended appointment slot has already ended
  const isAppointmentExpired = (a: any) => {
    if (!a || !a.date) return false;
    if (a.date < todayIST) return true;
    if (a.date === todayIST && a.status === 'CONFIRMED') {
      const [endH, endM] = (a.endTime || a.startTime || '00:00').split(':').map(Number);
      const slotEndMinutes = (endH || 0) * 60 + (endM || 0);
      return currentMinutes > slotEndMinutes;
    }
    return false;
  };

  // Pending reservations (held for 15 minutes)
  const pendingReservations = allAppointments.filter(
    (a: any) =>
      a.status === 'PENDING_PAYMENT' &&
      a.pendingExpiresAt &&
      new Date(a.pendingExpiresAt).getTime() > Date.now(),
  );

  // Upcoming / Active Appointments (must not be expired!)
  const upcoming = allAppointments
    .filter(
      (a: any) =>
        ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status) &&
        !isAppointmentExpired(a),
    )
    .sort((a: any, b: any) => {
      const dComp = a.date.localeCompare(b.date);
      if (dComp !== 0) return dComp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

  // Past / Completed / Missed Appointments
  const past = allAppointments
    .filter(
      (a: any) =>
        ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status) ||
        isAppointmentExpired(a),
    )
    .sort((a: any, b: any) => {
      const dComp = b.date.localeCompare(a.date);
      if (dComp !== 0) return dComp;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });

  // Check if there is a truly active (unexpired) appointment today
  const activeToday = upcoming.find((a: any) => a.date === todayIST);
  const nextVisit = activeToday || upcoming[0];

  const firstName = profile.fullName ? profile.fullName.split(' ')[0] : 'there';
  const patientIdShort = profile.id ? profile.id.slice(0, 8).toUpperCase() : 'PATIENT';

  return (
    <div className="page-container space-y-8 py-8 sm:py-10">
      {/* ═══════════════ ACTIVE PENDING RESERVATION ALERT ═══════════════ */}
      {pendingReservations.length > 0 && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50/90 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-200/80 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-5 h-5 text-amber-800 animate-spin" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Action Required
                </span>
                <span className="text-xs font-semibold text-amber-800">
                  {pendingReservations.length} slot{pendingReservations.length > 1 ? 's' : ''} reserved
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-amber-950">
                You have an unconfirmed consultation slot held for 15 minutes!
              </h3>
              <p className="text-xs text-amber-800 max-w-xl">
                Your slot with Dr. {pendingReservations[0].doctor?.fullName || 'Doctor'} on {formatDate(pendingReservations[0].date)} at {formatTime(pendingReservations[0].startTime)} is currently held. Complete payment before it expires to confirm your appointment.
              </p>
            </div>
          </div>
          <Link
            href="/patient/appointments"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <span>Complete Payment Now</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ═══════════════ PATIENT WELCOME & IDENTITY HEADER ═══════════════ */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#0066cc]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>CAREUP PATIENT PORTAL</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-slate-600 border border-slate-200">
              ID: #{patientIdShort}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back, {profile.fullName}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5 text-slate-700">
              <User className="h-3.5 w-3.5 text-slate-400" />
              {profile.age ? `${profile.age} yrs • ${profile.gender}` : 'Patient Profile'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              {profile.phone}
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              CareUp Medical Clinic
            </span>
          </div>
        </div>

        {/* Quick CTA Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/doctors"
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Book New Appointment</span>
          </Link>

          <Link
            href="/patient/profile"
            className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold shadow-xs"
          >
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span>My Profile</span>
          </Link>
        </div>
      </div>

      {/* ═══════════════ TODAY'S ACTIVE LIVE QUEUE BANNER (IF VISIT TODAY) ═══════════════ */}
      {activeToday && (
        <div className="rounded-3xl border-2 border-[#0066cc] bg-gradient-to-r from-blue-50/80 via-white to-sky-50/40 p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-[#0066cc] text-white flex flex-col items-center justify-center shrink-0 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">TOKEN</span>
                <span className="text-2xl font-black leading-none mt-0.5">
                  #{String(activeToday.tokenNumber || 1).padStart(2, '0')}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0066cc] px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    Appointment Scheduled for Today
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    Slot: {formatTime(activeToday.startTime)}
                    {activeToday.endTime ? ` – ${formatTime(activeToday.endTime)}` : ''}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                  Dr. {activeToday.doctor?.fullName} • {activeToday.doctor?.specialization}
                </h3>

                <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#0066cc]" />
                  <span>Room 1 • CareUp Consultation Suite</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PatientLiveQueueButton
                appointmentId={activeToday.id}
                variant="card"
                label="Open Live Queue & Room Tracker"
              />

              <a
                href="tel:01314960280"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                <span>Clinic Desk</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CLINICAL SUMMARY KPI METRICS ═══════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Upcoming Consultations */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Upcoming Visits</span>
            <div className="h-8 w-8 rounded-xl bg-sky-50 text-[#0066cc] flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{upcoming.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Confirmed appointments</p>
        </div>

        {/* Completed Visits */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completed Visits</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{past.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Consultation history</p>
        </div>

        {/* Notification Alerts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Messages & Alerts</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900 tabular-nums">{unreadCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Unread notifications</p>
        </div>

        {/* Registered Clinic Practice */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Clinic Practice</span>
            <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-bold text-slate-900 leading-tight">CareUp GP</div>
          <p className="text-[11px] text-slate-500 mt-1">NHS & Private Healthcare</p>
        </div>
      </div>

      {/* ═══════════════ UPCOMING APPOINTMENTS SECTION ═══════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#0066cc]" />
            <h2 className="text-lg font-bold text-slate-900">
              Upcoming Consultations ({upcoming.length})
            </h2>
          </div>
          <Link
            href="/patient/appointments"
            className="text-xs font-semibold text-[#0066cc] hover:underline inline-flex items-center gap-1"
          >
            <span>Manage All Visits</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-xs">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Active Appointments Scheduled</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You do not have any pending doctor visits. Book a certified general practitioner or specialist anytime.
            </p>
            <Link href="/doctors" className="btn-primary mt-4 inline-flex items-center gap-1.5 text-xs">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Book an Appointment</span>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {upcoming.map((appt, i) => {
              const isToday = appt.date === todayIST;
              return (
                <div
                  key={appt.id}
                  className={`rounded-2xl border bg-white p-5 shadow-xs transition-all hover:shadow-sm ${
                    isToday ? 'border-[#0066cc] ring-1 ring-[#0066cc]/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <DoctorAvatar
                        name={appt.doctor?.fullName || 'Doctor'}
                        size="md"
                        className="rounded-xl border border-slate-100 shadow-2xs"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            Dr. {appt.doctor?.fullName}
                          </h4>
                          {isToday ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 uppercase">
                              Today
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600 border border-slate-200">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 capitalize">{appt.doctor?.specialization}</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1 text-center">
                      <span className="text-[9px] font-bold uppercase text-slate-500 block">Token</span>
                      <span className="text-xs font-black text-slate-900 leading-tight">
                        #{String(appt.tokenNumber || (i + 1)).padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <Clock className="h-3.5 w-3.5 text-[#0066cc]" />
                      <span>
                        {isToday ? 'Today' : formatDate(appt.date)} • {formatTime(appt.startTime)}
                        {appt.endTime ? ` – ${formatTime(appt.endTime)}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isToday ? (
                        <PatientLiveQueueButton
                          appointmentId={appt.id}
                          variant="primary"
                          label="Live Queue"
                        />
                      ) : (
                        <Link
                          href="/patient/appointments"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          View Details
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══════════════ ESSENTIAL PATIENT QUICK ACTIONS ═══════════════ */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Patient Health Actions</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Action 1: Book Visit */}
          <Link
            href="/doctors"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#0066cc] hover:shadow-sm transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center mb-3 group-hover:bg-[#0066cc] group-hover:text-white transition-colors">
              <Stethoscope className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0066cc] transition-colors">
              Book a Doctor
            </h3>
            <p className="text-xs text-slate-500 mt-1">Select a general physician or specialist & slot</p>
          </Link>

          {/* Action 2: Appointments & Reschedule */}
          <Link
            href="/patient/appointments"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#0066cc] hover:shadow-sm transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-[#0066cc] flex items-center justify-center mb-3 group-hover:bg-[#0066cc] group-hover:text-white transition-colors">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0066cc] transition-colors">
              My Appointments
            </h3>
            <p className="text-xs text-slate-500 mt-1">View scheduled visits, live queue & reschedule</p>
          </Link>

          {/* Action 3: Health Profile & Allergies */}
          <Link
            href="/patient/profile"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#0066cc] hover:shadow-sm transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              Medical Notes
            </h3>
            <p className="text-xs text-slate-500 mt-1">Update basic health history, allergies & contact</p>
          </Link>

          {/* Action 4: Notifications */}
          <Link
            href="/patient/notifications"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-[#0066cc] hover:shadow-sm transition-all"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
              Alerts & Inbox
            </h3>
            <p className="text-xs text-slate-500 mt-1">Consultation reminders & live token alerts</p>
          </Link>
        </div>
      </section>

      {/* ═══════════════ RECENT VISITS & CLINIC CONTACT ═══════════════ */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Past Visits Preview */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Recent Consultations ({past.length})</span>
            </h3>
            <Link href="/patient/appointments" className="text-xs font-semibold text-[#0066cc] hover:underline">
              Full History
            </Link>
          </div>

          {past.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No previous consultations on record.</p>
          ) : (
            <div className="space-y-3">
              {past.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Dr. {item.doctor?.fullName || 'General Physician'}
                    </span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      {formatDate(item.date)} • {formatTime(item.startTime)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {item.status === 'COMPLETED' ? 'Completed' : item.status}
                    </span>

                    {item.doctor?.id && (
                      <Link
                        href={`/doctors/${item.doctor.id}`}
                        className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-[#0066cc] hover:bg-sky-50 transition-colors"
                      >
                        Book Again
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Practice & Support Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#0066cc]" />
            <span>Clinic & Healthcare Support</span>
          </h3>

          <div className="space-y-3 text-xs text-slate-600">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-1">
              <span className="font-bold text-slate-900 block">CareUp Medical Clinic</span>
              <p>Consultation Suites • Main Clinic Wing</p>
              <p className="text-slate-500">Appointments, Patient Triage & Live Token Queue</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Reception Desk</span>
                <a href="tel:01314960280" className="font-bold text-[#0066cc] hover:underline block mt-0.5">
                  0131 496 0280
                </a>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Clinic Hours</span>
                <span className="font-semibold text-slate-800 block mt-0.5">Mon–Fri: 08:00 – 18:30</span>
              </div>
            </div>

            {profile.basicHealthInfo && (
              <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-3 text-[11px] text-slate-700">
                <span className="font-bold text-[#0066cc] block mb-0.5">Your Recorded Health Notes:</span>
                <p className="line-clamp-2">{profile.basicHealthInfo}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
