'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import { formatTime, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import {
  RefreshCw,
  Loader2,
  UserCheck,
  PlayCircle,
  CheckCheck,
  UserX,
  Phone,
  Clock,
  Activity,
  Stethoscope,
  Info,
  Users,
  CheckCircle2,
  XCircle,
  Hash,
  ChevronRight,
  Sun,
  ArrowRight,
  User,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

type ActionType = 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show';

const STATUS_STYLE: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  CONFIRMED:       { label: 'Confirmed',   dot: 'bg-sky-500',     text: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-200' },
  CHECKED_IN:      { label: 'Checked In',  dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  IN_CONSULTATION: { label: 'In Consult',  dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  COMPLETED:       { label: 'Completed',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  CANCELLED:       { label: 'Cancelled',   dot: 'bg-rose-400',    text: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200' },
  NO_SHOW:         { label: 'No Show',     dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',   border: 'border-slate-200' },
};

const ACTIONS: Record<string, { action: ActionType; label: string; icon: React.ElementType; cls: string }[]> = {
  CONFIRMED:       [{ action: 'manual-check-in', label: 'Check In', icon: UserCheck, cls: 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs' }],
  CHECKED_IN:      [
    { action: 'start-consultation', label: 'Start Consult', icon: PlayCircle, cls: 'bg-blue-700 hover:bg-blue-800 text-white shadow-xs' },
    { action: 'no-show',            label: 'No Show',       icon: UserX,      cls: 'bg-slate-100 hover:bg-slate-200 text-slate-600' },
  ],
  IN_CONSULTATION: [
    { action: 'complete', label: 'Complete', icon: CheckCheck, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' },
    { action: 'no-show',  label: 'No Show',  icon: UserX,      cls: 'bg-slate-100 hover:bg-slate-200 text-slate-600' },
  ],
};

interface DoctorLiveQueueClientProps {
  initialAppointments: Appointment[];
  selectedDate: string;
  todayIST: string;
}

export function DoctorLiveQueueClient({ initialAppointments, selectedDate, todayIST }: DoctorLiveQueueClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setCurrentTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await clientAxios.get(`/api/doctor/appointments?date=${selectedDate}`);
      const data = res.data?.data || res.data || [];
      setAppointments(Array.isArray(data) ? data : []);
      toast.success('Queue refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [selectedDate]);

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

  /* Queue categorization */
  const activeAppt = appointments.find((a) => a.status === 'IN_CONSULTATION');
  const checkedInList = appointments
    .filter((a) => a.status === 'CHECKED_IN')
    .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
  const confirmedList = appointments
    .filter((a) => a.status === 'CONFIRMED')
    .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
  const completedList = appointments
    .filter((a) => a.status === 'COMPLETED')
    .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
  const otherList = appointments.filter((a) => ['CANCELLED', 'NO_SHOW'].includes(a.status));

  const totalPatients = appointments.length;
  const waitingCount = checkedInList.length;
  const stillArrivingCount = confirmedList.length;
  const totalRemaining = (activeAppt ? 1 : 0) + waitingCount + stillArrivingCount;
  const nextUp = checkedInList[0] || confirmedList[0];

  const isToday = selectedDate === todayIST;

  // Full ordered queue for active/today display
  const orderedQueue = [
    ...(activeAppt ? [activeAppt] : []),
    ...checkedInList,
    ...confirmedList,
    ...completedList,
    ...otherList,
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Live Consultation Queue</h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                {formatDate(selectedDate)} {isToday ? '• Today' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isToday && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 tabular-nums">
                <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse flex-shrink-0" />
                {currentTime}
              </div>
            )}

            {/* Date picker */}
            <form
              method="GET"
              action="/doctor/appointments"
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs"
            >
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none"
              />
              <button type="submit" className="text-xs font-bold text-blue-700 hover:text-blue-900 px-1">
                Go
              </button>
              {!isToday && (
                <Link href="/doctor/appointments" className="text-xs text-slate-400 hover:text-slate-700 font-medium ml-1">
                  Today
                </Link>
              )}
            </form>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/doctor/my-day"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-xs"
            >
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">My Day</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Summary Stats Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">Total Patients</span>
            <div className="text-2xl font-black text-slate-900 tabular-nums mt-1">{totalPatients}</div>
            <span className="text-[11px] text-slate-400 block mt-0.5">Scheduled on this date</span>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide block">Waiting in Clinic</span>
            <div className="text-2xl font-black text-amber-800 tabular-nums mt-1">{waitingCount}</div>
            <span className="text-[11px] text-amber-600 block mt-0.5">Checked in & ready</span>
          </div>
          <div className="bg-white rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wide block">Still Arriving</span>
            <div className="text-2xl font-black text-sky-800 tabular-nums mt-1">{stillArrivingCount}</div>
            <span className="text-[11px] text-sky-600 block mt-0.5">Confirmed appointments</span>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide block">Done Today</span>
            <div className="text-2xl font-black text-emerald-800 tabular-nums mt-1">{completedList.length}</div>
            <span className="text-[11px] text-emerald-600 block mt-0.5">Consultations completed</span>
          </div>
        </div>

        {/* ── Spotlight: Now Serving vs Next Up ── */}
        <div className="grid md:grid-cols-12 gap-5">
          {/* NOW SERVING BOARD (7 cols) */}
          <div className="md:col-span-7 bg-white rounded-3xl border-2 border-blue-600 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 bg-blue-600 text-white rounded-bl-2xl text-[11px] font-bold uppercase tracking-wider">
              Active Consultation
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Now Serving</span>
              </div>

              {activeAppt ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-blue-700 text-white flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Token</span>
                    <span className="text-3xl font-black leading-none mt-0.5">
                      {activeAppt.tokenNumber != null ? `#${activeAppt.tokenNumber}` : '—'}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-bold text-slate-900 truncate">
                      {activeAppt.patient?.fullName || 'Patient'}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatTime(activeAppt.startTime)} – {formatTime(activeAppt.endTime)}
                      </span>
                      {activeAppt.patient?.age && (
                        <span>{activeAppt.patient.age} yrs • {activeAppt.patient.gender}</span>
                      )}
                      {activeAppt.patient?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {activeAppt.patient.phone}
                        </span>
                      )}
                    </div>

                    {activeAppt.patient?.basicHealthInfo && (
                      <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold text-slate-700">Health info:</span> {activeAppt.patient.basicHealthInfo}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-center">
                  <Stethoscope className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-base font-bold text-slate-800">No Consultation In Progress</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {waitingCount > 0
                      ? `${waitingCount} patient(s) waiting in the clinic. Call the next patient below.`
                      : stillArrivingCount > 0
                      ? `${stillArrivingCount} patient(s) expected today. Awaiting check-in.`
                      : 'All patient consultations completed for this date.'}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              {activeAppt ? (
                <>
                  <div className="text-xs text-slate-500 font-medium">
                    {waitingCount} patient(s) waiting after this token
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(activeAppt.id, 'complete')}
                      disabled={!!loadingId}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60"
                    >
                      {loadingId === `${activeAppt.id}-complete` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCheck className="w-4 h-4" />
                      )}
                      Mark Consultation Complete
                    </button>
                    <button
                      onClick={() => handleAction(activeAppt.id, 'no-show')}
                      disabled={!!loadingId}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                    >
                      No Show
                    </button>
                  </div>
                </>
              ) : nextUp && nextUp.status === 'CHECKED_IN' ? (
                <div className="w-full flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 font-medium">
                    Ready to call: <span className="font-bold text-slate-900">{nextUp.patient?.fullName}</span> (Token #{nextUp.tokenNumber})
                  </div>
                  <button
                    onClick={() => handleAction(nextUp.id, 'start-consultation')}
                    disabled={!!loadingId}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60"
                  >
                    {loadingId === `${nextUp.id}-start-consultation` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlayCircle className="w-4 h-4" />
                    )}
                    Call Next Token (#{nextUp.tokenNumber})
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Queue is idle. Waiting for patient arrival.</div>
              )}
            </div>
          </div>

          {/* NEXT IN LINE BOARD (5 cols) */}
          <div className="md:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Next In Line</span>
                {nextUp && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      nextUp.status === 'CHECKED_IN'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {nextUp.status === 'CHECKED_IN' ? 'In Waiting Room' : 'Expected'}
                  </span>
                )}
              </div>

              {nextUp ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-14 h-14 rounded-2xl text-white flex flex-col items-center justify-center flex-shrink-0 shadow-xs ${
                        nextUp.status === 'CHECKED_IN' ? 'bg-amber-500' : 'bg-slate-700'
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Token</span>
                      <span className="text-xl font-black leading-none mt-0.5">
                        {nextUp.tokenNumber != null ? `#${nextUp.tokenNumber}` : '—'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-base truncate">
                        {nextUp.patient?.fullName || 'Patient'}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Slot: {formatTime(nextUp.startTime)} – {formatTime(nextUp.endTime)}
                      </div>
                      {nextUp.patient?.age && (
                        <div className="text-xs text-slate-400">
                          {nextUp.patient.age} yrs • {nextUp.patient.gender}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Queue Position:</span>
                      <span className="font-bold text-slate-800">#1 Next Up</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Status:</span>
                      <span className="font-bold text-slate-800">
                        {nextUp.status === 'CHECKED_IN' ? 'Waiting in clinic' : 'Not checked in yet'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No upcoming patients remaining in the queue.
                </div>
              )}
            </div>

            {nextUp && (
              <div className="mt-5 pt-3 border-t border-slate-100">
                {nextUp.status === 'CHECKED_IN' ? (
                  <button
                    onClick={() => handleAction(nextUp.id, 'start-consultation')}
                    disabled={!!loadingId}
                    className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-60"
                  >
                    {loadingId === `${nextUp.id}-start-consultation` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="w-3.5 h-3.5" />
                    )}
                    Start Consultation with Token #{nextUp.tokenNumber}
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction(nextUp.id, 'manual-check-in')}
                    disabled={!!loadingId}
                    className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-60"
                  >
                    {loadingId === `${nextUp.id}-manual-check-in` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    Check In Patient When Arrived
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Side-by-Side Queue Sections ── */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Complete Queue Order List (8 cols) */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Sequence of Tokens (All Patients)</h2>
              </div>
              <span className="text-xs text-slate-500 font-semibold">{orderedQueue.length} Total</span>
            </div>

            {orderedQueue.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
                <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No appointments scheduled for this date</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orderedQueue.map((appt, idx) => {
                  const ss = STATUS_STYLE[appt.status] || STATUS_STYLE.CONFIRMED;
                  const acts = ACTIONS[appt.status] || [];
                  const isAct = appt.status === 'IN_CONSULTATION';
                  const isCI = appt.status === 'CHECKED_IN';
                  const isDone = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status);

                  return (
                    <div
                      key={appt.id}
                      className={`rounded-2xl border transition-all duration-150 overflow-hidden bg-white ${
                        isAct
                          ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-xs'
                          : isCI
                          ? 'border-amber-300 shadow-xs'
                          : isDone
                          ? 'border-slate-200/60 bg-slate-50/50 opacity-70'
                          : 'border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-stretch">
                        {/* Token Badge */}
                        <div
                          className={`w-16 flex-shrink-0 flex flex-col items-center justify-center py-3.5 border-r ${
                            isAct
                              ? 'bg-blue-700 border-blue-800 text-white'
                              : isCI
                              ? 'bg-amber-500 border-amber-600 text-white'
                              : isDone
                              ? 'bg-slate-100 border-slate-200 text-slate-400'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Token</span>
                          <span className="text-base font-black leading-none mt-0.5">
                            {appt.tokenNumber != null ? `#${appt.tokenNumber}` : `#${idx + 1}`}
                          </span>
                        </div>

                        {/* Patient Details */}
                        <div className="flex-1 p-3.5 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm truncate">
                                {appt.patient?.fullName || 'Patient'}
                              </span>
                              {isAct && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                  Inside Clinic
                                </span>
                              )}
                              {isCI && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Waiting in clinic
                                </span>
                              )}
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${ss.bg} ${ss.text} ${ss.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                              {ss.label}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                            </span>
                            {appt.patient?.age && <span>{appt.patient.age} yrs • {appt.patient.gender}</span>}
                            {appt.patient?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {appt.patient.phone}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {acts.length > 0 && (
                          <div className="flex items-center gap-1.5 pr-3.5">
                            {acts.map(({ action, label, icon: Icon, cls }) => {
                              const lid = `${appt.id}-${action}`;
                              const busy = loadingId === lid;
                              return (
                                <button
                                  key={action}
                                  onClick={() => handleAction(appt.id, action)}
                                  disabled={!!loadingId}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-50 ${cls}`}
                                >
                                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                                  <span className="hidden sm:inline">{label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Side Panels: Waiting Room & Arriving (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Waiting Room (Checked in) */}
            <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Waiting Room ({checkedInList.length})
                  </span>
                </div>
                <span className="text-[11px] text-amber-700 font-semibold">In Clinic</span>
              </div>

              {checkedInList.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  No patients waiting in clinic right now.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {checkedInList.map((a, i) => (
                    <div key={a.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                          {a.tokenNumber != null ? `#${a.tokenNumber}` : i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {a.patient?.fullName || 'Patient'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Slot: {formatTime(a.startTime)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAction(a.id, 'start-consultation')}
                        disabled={!!loadingId}
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all flex-shrink-0"
                        title="Start Consultation"
                      >
                        {loadingId === `${a.id}-start-consultation` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlayCircle className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Expected Today (Confirmed, not yet checked in) */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Still Arriving ({confirmedList.length})
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">Expected</span>
              </div>

              {confirmedList.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  No other confirmed patients for today.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {confirmedList.map((a, i) => (
                    <div key={a.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {a.tokenNumber != null ? `#${a.tokenNumber}` : i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {a.patient?.fullName || 'Patient'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Slot: {formatTime(a.startTime)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAction(a.id, 'manual-check-in')}
                        disabled={!!loadingId}
                        className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold transition-all flex-shrink-0"
                      >
                        {loadingId === `${a.id}-manual-check-in` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Check In'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
