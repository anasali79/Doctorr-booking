'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Appointment, Doctor } from '@/types';
import { formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import {
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Calendar,
  Loader2,
  Phone,
  UserCheck,
  PlayCircle,
  CheckCheck,
  UserX,
  RefreshCw,
  Stethoscope,
  CalendarDays,
  Activity,
  ListChecks,
  Info,
  BadgeCheck,
  Coffee,
  Check,
  Sparkles,
} from 'lucide-react';

interface DoctorDashboardStats {
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  totalPatients: number;
}

interface MyDayClientProps {
  profile: Doctor;
  appointments: Appointment[];
  stats: DoctorDashboardStats;
  today: string;
  doctorName: string;
}

function getGreeting(hour: number) {
  if (hour < 12) return { label: 'Good Morning', icon: Coffee, sub: 'Here is your clinic schedule for today' };
  if (hour < 17) return { label: 'Good Afternoon', icon: Stethoscope, sub: 'Continuing today’s patient consultations' };
  return { label: 'Good Evening', icon: Clock, sub: 'Wrapping up today’s consultations' };
}

type ActionType = 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show';

const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  CONFIRMED:       { label: 'Confirmed',   dot: 'bg-sky-500',     text: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-200' },
  CHECKED_IN:      { label: 'Checked In',  dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  IN_CONSULTATION: { label: 'In Consult',  dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  COMPLETED:       { label: 'Completed',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  CANCELLED:       { label: 'Cancelled',   dot: 'bg-rose-400',    text: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200' },
  NO_SHOW:         { label: 'No Show',     dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',   border: 'border-slate-200' },
  RESCHEDULED:     { label: 'Rescheduled', dot: 'bg-indigo-400',  text: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-200' },
};

const ACTIONS: Record<string, { action: ActionType; label: string; icon: React.ElementType; cls: string }[]> = {
  CONFIRMED:       [{ action: 'manual-check-in', label: 'Check In', icon: UserCheck, cls: 'bg-sky-600 hover:bg-sky-700 text-white' }],
  CHECKED_IN:      [
    { action: 'start-consultation', label: 'Start Consult', icon: PlayCircle, cls: 'bg-blue-700 hover:bg-blue-800 text-white' },
    { action: 'no-show',            label: 'No Show',       icon: UserX,      cls: 'bg-slate-100 hover:bg-slate-200 text-slate-600' },
  ],
  IN_CONSULTATION: [
    { action: 'complete', label: 'Complete', icon: CheckCheck, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { action: 'no-show',  label: 'No Show',  icon: UserX,      cls: 'bg-slate-100 hover:bg-slate-200 text-slate-600' },
  ],
};

function AppointmentCard({
  appt,
  onAction,
  loadingId,
  position,
  total,
}: {
  appt: Appointment;
  onAction: (id: string, action: ActionType) => void;
  loadingId: string | null;
  position: number;
  total: number;
}) {
  const sm = STATUS_META[appt.status] || STATUS_META.CONFIRMED;
  const actions = ACTIONS[appt.status] || [];
  const patient = appt.patient;
  const isActive = appt.status === 'IN_CONSULTATION';
  const isCheckedIn = appt.status === 'CHECKED_IN';
  const isDone = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status);

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden bg-white ${
        isActive
          ? 'border-blue-500 shadow-md ring-1 ring-blue-500/20'
          : isCheckedIn
          ? 'border-amber-300 shadow-sm'
          : isDone
          ? 'border-slate-200/60 bg-slate-50/50 opacity-75'
          : 'border-slate-200 hover:border-slate-300 shadow-sm'
      }`}
    >
      <div className="flex items-stretch">
        {/* Token column */}
        <div
          className={`flex-shrink-0 w-16 flex flex-col items-center justify-center py-4 border-r ${
            isActive
              ? 'bg-blue-700 border-blue-800 text-white'
              : isCheckedIn
              ? 'bg-amber-500 border-amber-600 text-white'
              : isDone
              ? 'bg-slate-100 border-slate-200 text-slate-400'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Token</span>
          <span className="text-lg font-black leading-tight mt-0.5">
            {appt.tokenNumber != null ? `#${appt.tokenNumber}` : `#${position}`}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{patient?.fullName || 'Patient'}</span>
              {isActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Currently Serving
                </span>
              )}
              {isCheckedIn && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Waiting in Clinic
                </span>
              )}
            </div>

            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${sm.bg} ${sm.text} ${sm.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
              {sm.label}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
            </span>
            {patient?.age && (
              <span>
                {patient.age} yrs • {patient.gender}
              </span>
            )}
            {patient?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                {patient.phone}
              </span>
            )}
          </div>

          {patient?.basicHealthInfo && (
            <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 line-clamp-1">
              <span className="font-semibold text-slate-700">Notes:</span> {patient.basicHealthInfo}
            </p>
          )}

          {/* Action buttons */}
          {actions.length > 0 && (
            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
              {actions.map(({ action, label, icon: Icon, cls }) => {
                const lid = `${appt.id}-${action}`;
                const busy = loadingId === lid;
                return (
                  <button
                    key={action}
                    onClick={() => onAction(appt.id, action)}
                    disabled={!!loadingId}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-50 ${cls}`}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type FilterType = 'all' | 'active' | 'pending' | 'done';

export function MyDayClient({
  profile,
  appointments: initialAppointments,
  stats,
  today,
  doctorName,
}: MyDayClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const hour = new Date().getHours();
  const { label: greeting, icon: GreetIcon, sub: greetSub } = getGreeting(hour);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await clientAxios.get(`/api/doctor/appointments?date=${today}`);
      const data = res.data?.data || res.data || [];
      setAppointments(Array.isArray(data) ? data : []);
      toast.success('Queue refreshed');
    } catch {
      toast.error('Failed to refresh queue');
    } finally {
      setRefreshing(false);
    }
  }, [today]);

  const handleAction = async (appointmentId: string, action: ActionType) => {
    const lid = `${appointmentId}-${action}`;
    setLoadingId(lid);
    try {
      await clientAxios.post(`/api/doctor/appointments/${appointmentId}/action?action=${action}`);
      const labels: Record<ActionType, string> = {
        'manual-check-in': 'Patient marked as checked in',
        'start-consultation': 'Consultation started',
        complete: 'Consultation completed ✓',
        'no-show': 'Marked as no-show',
      };
      toast.success(labels[action]);
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id !== appointmentId) return a;
          const n = { ...a };
          if (action === 'manual-check-in') n.status = 'CHECKED_IN';
          else if (action === 'start-consultation') n.status = 'IN_CONSULTATION';
          else if (action === 'complete') n.status = 'COMPLETED';
          else if (action === 'no-show') n.status = 'NO_SHOW';
          return n;
        }),
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setLoadingId(null);
    }
  };

  const total = appointments.length;
  const pending = appointments.filter((a) => a.status === 'CONFIRMED').length;
  const checkedIn = appointments.filter((a) => a.status === 'CHECKED_IN').length;
  const inConsult = appointments.filter((a) => a.status === 'IN_CONSULTATION').length;
  const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
  const cancelled = appointments.filter((a) => ['CANCELLED', 'NO_SHOW'].includes(a.status)).length;
  const remaining = pending + checkedIn + inConsult;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const filteredAppointments = appointments.filter((a) => {
    if (filter === 'active') return ['IN_CONSULTATION', 'CHECKED_IN'].includes(a.status);
    if (filter === 'pending') return a.status === 'CONFIRMED';
    if (filter === 'done') return ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status);
    return true;
  });

  const sortedAppointments = [...filteredAppointments].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const activeAppt = appointments.find((a) => a.status === 'IN_CONSULTATION');
  const nextAppt = appointments.find((a) => a.status === 'CHECKED_IN') || appointments.find((a) => a.status === 'CONFIRMED');

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const filterTabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all',     label: 'All Patients', count: total },
    { key: 'active',  label: 'In Clinic',    count: inConsult + checkedIn },
    { key: 'pending', label: 'Expected',     count: pending },
    { key: 'done',    label: 'Done',         count: completed + cancelled },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-12">
      {/* ── Top Bar ── */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">My Day Overview</h1>
              <p className="text-xs text-slate-500 hidden sm:block">{todayFormatted}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 tabular-nums">
              <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse flex-shrink-0" />
              {currentTime}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/doctor/appointments"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-all shadow-xs"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Live Queue Board</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Welcome Clinical Header Card ── */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-blue-700 text-xs font-bold uppercase tracking-wider mb-1.5">
                <GreetIcon className="w-3.5 h-3.5 text-blue-600" />
                {greeting}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Dr. {profile.fullName}</h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{profile.specialization}</span>
                <span>•</span>
                <span>{greetSub}</span>
              </div>
            </div>

            {/* Daily summary chips */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3 text-center">
                <div className="text-2xl font-black text-slate-900 tabular-nums">{total}</div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Today Total</div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl px-4 py-3 text-center">
                <div className="text-2xl font-black text-emerald-800 tabular-nums">{completed}</div>
                <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">Done</div>
              </div>
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl px-4 py-3 text-center">
                <div className="text-2xl font-black text-amber-800 tabular-nums">{remaining}</div>
                <div className="text-[11px] font-semibold text-amber-700 mt-0.5">Remaining</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Day Progress Bar ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Today's Consultation Progress
            </span>
            <span className="text-xs font-bold text-blue-800 tabular-nums">
              {completed} of {total} completed ({progress}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Confirmed (Expected)', value: pending,   color: 'text-sky-800',     bg: 'bg-sky-50/80',     border: 'border-sky-200' },
              { label: 'Checked In (Waiting)', value: checkedIn, color: 'text-amber-800',   bg: 'bg-amber-50/80',   border: 'border-amber-200' },
              { label: 'In Consultation',      value: inConsult, color: 'text-blue-800',    bg: 'bg-blue-50/80',    border: 'border-blue-200' },
              { label: 'Completed',            value: completed, color: 'text-emerald-800', bg: 'bg-emerald-50/80', border: 'border-emerald-200' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-3 border ${s.bg} ${s.border}`}>
                <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[11px] font-medium text-slate-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Now In Consultation & Up Next ── */}
        {(activeAppt || nextAppt) && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Active Consultation Spotlight */}
            {activeAppt ? (
              <div className="rounded-2xl border-2 border-blue-500 bg-white shadow-xs p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      Now Inside Clinic
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">In Progress</span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-700 text-white flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                      <span className="text-[9px] font-bold uppercase opacity-80">Token</span>
                      <span className="text-xl font-black leading-none mt-0.5">
                        {activeAppt.tokenNumber != null ? `#${activeAppt.tokenNumber}` : '—'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-base truncate">
                        {activeAppt.patient?.fullName || 'Patient'}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Slot: {formatTime(activeAppt.startTime)} – {formatTime(activeAppt.endTime)}
                      </div>
                      {activeAppt.patient?.age && (
                        <div className="text-xs text-slate-400">
                          {activeAppt.patient.age} yrs • {activeAppt.patient.gender}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleAction(activeAppt.id, 'complete')}
                  disabled={!!loadingId}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-60 shadow-xs"
                >
                  {loadingId === `${activeAppt.id}-complete` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4" />
                  )}
                  Finish Consultation
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 flex flex-col items-center justify-center text-center">
                <Stethoscope className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No Patient Inside</p>
                <p className="text-xs text-slate-400 mt-0.5">Start consultation for the next waiting patient.</p>
              </div>
            )}

            {/* Next in Line */}
            {nextAppt && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <span className={`w-2 h-2 rounded-full ${nextAppt.status === 'CHECKED_IN' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                      {nextAppt.status === 'CHECKED_IN' ? 'Next Patient (Waiting)' : 'Up Next (Expected)'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {nextAppt.status === 'CHECKED_IN' ? 'Checked in ✓' : 'Awaiting arrival'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-white shadow-xs ${
                        nextAppt.status === 'CHECKED_IN' ? 'bg-amber-500' : 'bg-slate-700'
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase opacity-80">Token</span>
                      <span className="text-xl font-black leading-none mt-0.5">
                        {nextAppt.tokenNumber != null ? `#${nextAppt.tokenNumber}` : '—'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-base truncate">
                        {nextAppt.patient?.fullName || 'Patient'}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Slot: {formatTime(nextAppt.startTime)} – {formatTime(nextAppt.endTime)}
                      </div>
                      {nextAppt.patient?.age && (
                        <div className="text-xs text-slate-400">
                          {nextAppt.patient.age} yrs • {nextAppt.patient.gender}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {nextAppt.status === 'CHECKED_IN' ? (
                  <button
                    onClick={() => handleAction(nextAppt.id, 'start-consultation')}
                    disabled={!!loadingId}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-60 shadow-xs"
                  >
                    {loadingId === `${nextAppt.id}-start-consultation` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlayCircle className="w-4 h-4" />
                    )}
                    Call Patient In
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction(nextAppt.id, 'manual-check-in')}
                    disabled={!!loadingId}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-60 shadow-xs"
                  >
                    {loadingId === `${nextAppt.id}-manual-check-in` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    Patient Arrived (Check In)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Quick Clinical Navigation ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/doctor/appointments', label: 'Live Queue Board', desc: 'Call tokens & queue', icon: Activity, bg: 'bg-blue-50 text-blue-700 border-blue-200' },
            { href: '/doctor/availability', label: 'Doctor Schedule', desc: 'Slots & timing', icon: Calendar, bg: 'bg-sky-50 text-sky-700 border-sky-200' },
            { href: '/doctor/availability?tab=leaves', label: 'Leave / Off Days', desc: 'Set clinic leave', icon: Coffee, bg: 'bg-amber-50 text-amber-700 border-amber-200' },
            { href: '/doctor/profile', label: 'My Clinic Profile', desc: 'Fee, address, bio', icon: BadgeCheck, bg: 'bg-slate-50 text-slate-700 border-slate-200' },
          ].map(({ href, label, desc, icon: Icon, bg }) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
            >
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${bg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">{label}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">{desc}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Today's Queue Section ── */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Today's Appointment List</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {total}
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-xs">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filter === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {sortedAppointments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No appointments in this category</p>
              <p className="text-xs text-slate-400 mt-0.5">Switch filters above to view other patients.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedAppointments.map((appt, idx) => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  onAction={handleAction}
                  loadingId={loadingId}
                  position={idx + 1}
                  total={sortedAppointments.length}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
