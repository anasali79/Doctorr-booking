'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import { formatTime, formatDate, cn } from '@/lib/utils';
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
  Hash,
  Sun,
  FileText,
  Headphones,
  Radio,
  Timer,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SmoothDatePicker } from '@/components/ui/smooth-date-picker';
import { DoctorPrescriptionModal } from '@/components/prescription/DoctorPrescriptionModal';
import { useAppointmentSocket } from '@/hooks/useAppointmentSocket';

type ActionType = 'start-consultation' | 'complete' | 'no-show';

const STATUS_STYLE: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  CONFIRMED:       { label: 'Confirmed',   dot: 'bg-sky-500',   text: 'text-sky-700',   bg: 'bg-sky-50',    border: 'border-sky-200' },
  CHECKED_IN:      { label: 'Checked In',  dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
  IN_CONSULTATION: { label: 'In Consult',  dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700', bg: 'bg-blue-50',   border: 'border-blue-200' },
  COMPLETED:       { label: 'Completed',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  CANCELLED:       { label: 'Cancelled',   dot: 'bg-rose-400',  text: 'text-rose-600',  bg: 'bg-rose-50',   border: 'border-rose-200' },
  NO_SHOW:         { label: 'No Show',     dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
};

// Doctor only executes Clinical Consultation Actions (Check-in is managed by Front-Desk Receptionist)
const ACTIONS: Record<string, { action: ActionType; label: string; icon: React.ElementType; cls: string }[]> = {
  CONFIRMED: [], // No check-in for doctor; handled strictly by front-desk receptionist
  CHECKED_IN: [
    { action: 'start-consultation', label: 'Call into Cabin', icon: PlayCircle, cls: 'bg-blue-700 hover:bg-blue-800 text-white shadow-xs cursor-pointer' },
    { action: 'no-show', label: 'No Show', icon: UserX, cls: 'bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer' },
  ],
  IN_CONSULTATION: [
    { action: 'complete', label: 'Complete', icon: CheckCheck, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer' },
    { action: 'no-show', label: 'No Show', icon: UserX, cls: 'bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer' },
  ],
};

interface DoctorLiveQueueClientProps {
  initialAppointments: Appointment[];
  selectedDate: string;
  todayIST: string;
  doctorId?: string;
}

export function DoctorLiveQueueClient({
  initialAppointments,
  selectedDate,
  todayIST,
  doctorId,
}: DoctorLiveQueueClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [prescriptionAppt, setPrescriptionAppt] = useState<Appointment | null>(null);

  const fetchAppointmentsSilent = useCallback(async () => {
    try {
      const res = await clientAxios.get(`/api/doctor/appointments?date=${selectedDate}`);
      const data = res.data?.data || res.data || [];
      setAppointments(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  }, [selectedDate]);

  // Real-time socket sync
  const { isConnected } = useAppointmentSocket({
    role: 'doctor',
    profileId: doctorId,
    onEvent: (event) => {
      if (
        event === 'queue.updated' ||
        event === 'doctor.status.board' ||
        event === 'appointment.updated' ||
        event === 'appointment.created' ||
        event === 'appointment.cancelled'
      ) {
        fetchAppointmentsSilent();
      }
    },
  });

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
        'start-consultation': 'Consultation started (Patient in Cabin)',
        complete: 'Consultation completed ✓',
        'no-show': 'Marked as no-show',
      };
      toast.success(labels[action]);
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id !== appointmentId) return a;
          const n = { ...a };
          if (action === 'start-consultation') n.status = 'IN_CONSULTATION';
          else if (action === 'complete') n.status = 'COMPLETED';
          else if (action === 'no-show') n.status = 'NO_SHOW';
          return n;
        }),
      );
      router.refresh();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Action failed';
      toast.error(errorMsg || 'Action failed');
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
  const nextUp = checkedInList[0] || confirmedList[0];

  const isToday = selectedDate === todayIST;

  // Helper to parse time string like "10:00", "10:00:00", or "10:00 AM" into minutes from midnight
  const parseTimeToMinutes = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    const match12 = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const mins = parseInt(match12[2], 10);
      const meridian = match12[4].toUpperCase();
      if (meridian === 'PM' && hours < 12) hours += 12;
      if (meridian === 'AM' && hours === 12) hours = 0;
      return hours * 60 + mins;
    }
    const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const mins = parseInt(match24[2], 10);
      return hours * 60 + mins;
    }
    return null;
  };

  // Live Queue Pace Estimation (On Time / Ahead / Behind schedule)
  const queuePace = useMemo(() => {
    if (!isToday || appointments.length === 0) {
      return {
        status: 'ON_SCHEDULE',
        label: 'On Schedule',
        badge: 'On Time',
        textCls: 'text-emerald-800',
        bgCls: 'bg-emerald-50/70 border-emerald-200',
      };
    }
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    if (activeAppt) {
      const endMins = parseTimeToMinutes(activeAppt.endTime);
      if (endMins != null) {
        const diff = currentMins - endMins;
        if (diff > 5) {
          return {
            status: 'BEHIND',
            label: `${diff}m Behind`,
            badge: `${diff}m Behind Schedule`,
            textCls: 'text-amber-800',
            bgCls: 'bg-amber-50/70 border-amber-200',
          };
        } else if (diff < -5) {
          const ahead = Math.abs(diff);
          return {
            status: 'AHEAD',
            label: `${ahead}m Ahead`,
            badge: `${ahead}m Ahead of Schedule`,
            textCls: 'text-sky-800',
            bgCls: 'bg-sky-50/70 border-sky-200',
          };
        }
      }
    } else if (nextUp) {
      const startMins = parseTimeToMinutes(nextUp.startTime);
      if (startMins != null) {
        const diff = currentMins - startMins;
        if (diff > 10) {
          return {
            status: 'BEHIND',
            label: `${diff}m Behind`,
            badge: `${diff}m Behind Schedule`,
            textCls: 'text-amber-800',
            bgCls: 'bg-amber-50/70 border-amber-200',
          };
        }
      }
    }

    return {
      status: 'ON_SCHEDULE',
      label: 'On Schedule',
      badge: 'Running on time',
      textCls: 'text-emerald-800',
      bgCls: 'bg-emerald-50/70 border-emerald-200',
    };
  }, [isToday, appointments, activeAppt, nextUp]);

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
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  Live Consultation Queue
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full border gap-1 hidden sm:inline-flex items-center',
                    isConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200',
                  )}
                >
                  <Radio
                    className={cn(
                      'h-2.5 w-2.5',
                      isConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500',
                    )}
                  />
                  <span>{isConnected ? 'Real-Time Sync' : 'Connecting'}</span>
                </Badge>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {formatDate(selectedDate)} {isToday ? '• Today' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs cursor-pointer"
            >
              <Link href="/doctor/receptionists">
                <Headphones className="w-3.5 h-3.5 text-[#0066cc]" />
                <span>Front Desk Staff</span>
              </Link>
            </Button>

            {isToday && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 tabular-nums">
                <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse flex-shrink-0" />
                {currentTime}
              </div>
            )}

            {/* Date picker */}
            <div className="flex items-center gap-1.5">
              <SmoothDatePicker
                value={selectedDate}
                onChange={(d) => router.push(`/doctor/appointments?date=${d}`)}
                className="py-1.5 px-3 text-xs font-semibold shadow-xs"
              />
              {!isToday && (
                <Link
                  href="/doctor/appointments"
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors shrink-0"
                >
                  Today
                </Link>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              asChild
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Link href="/doctor/my-day">
                <Sun className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">My Day</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── Live Queue Management Status Banner (Inspired by Image 3) ── */}
        {activeAppt ? (
          <div className="p-4 sm:p-5 rounded-3xl border border-blue-600 bg-gradient-to-r from-blue-600 via-blue-700 to-sky-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
                <Stethoscope className="w-6 h-6 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white leading-tight">
                    Consultation in Progress • Room 1 Active
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500 text-white tracking-wide border border-blue-400">
                    Token #{activeAppt.tokenNumber != null ? activeAppt.tokenNumber : '—'} Inside
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-1 truncate">
                  Now consulting <strong className="text-white">{activeAppt.patient?.fullName || 'Patient'}</strong>. {waitingCount} patient(s) waiting in clinic.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => setPrescriptionAppt(activeAppt)}
                className="rounded-xl bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs h-9 px-3.5 shadow-xs cursor-pointer gap-1.5"
              >
                <FileText className="w-4 h-4 text-blue-700" />
                <span>Write / Edit Rx</span>
              </Button>
            </div>
          </div>
        ) : waitingCount > 0 && nextUp ? (
          <div className="p-4 sm:p-5 rounded-3xl border border-emerald-300 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <PlayCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white leading-tight">
                    Doctor Cabin Ready • Room 1
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white tracking-wide border border-emerald-400">
                    Token #{nextUp.tokenNumber != null ? nextUp.tokenNumber : '—'} Ready
                  </span>
                </div>
                <p className="text-xs text-emerald-100 mt-1 truncate">
                  <strong className="text-white">{nextUp.patient?.fullName}</strong> has been checked in by front desk and is waiting in clinic.
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <Button
                onClick={() => handleAction(nextUp.id, 'start-consultation')}
                disabled={!!loadingId}
                className="rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 font-bold text-xs h-9 px-4 shadow-xs cursor-pointer gap-1.5"
              >
                {loadingId === `${nextUp.id}-start-consultation` ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                ) : (
                  <PlayCircle className="w-4 h-4 text-emerald-700" />
                )}
                <span>Call Patient In</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-3xl border border-slate-200 bg-white text-slate-800 flex items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                <Stethoscope className="w-5 h-5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                  Doctor Cabin Ready • Room 1
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stillArrivingCount > 0
                    ? `${stillArrivingCount} patient(s) confirmed today. Front-desk receptionist will check them in upon arrival.`
                    : 'All patient consultations completed for this date.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-xs font-semibold text-slate-600 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Cabin Available</span>
            </div>
          </div>
        )}

        {/* ── 4 Metric Cards (Image 3 Style with Estimated Ahead / Behind Pace) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: NOW SERVING */}
          <Card className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
              Now Serving
            </span>
            <div className="text-2xl font-black text-slate-900 tabular-nums mt-1">
              {activeAppt?.tokenNumber != null ? `#${activeAppt.tokenNumber}` : '—'}
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5 truncate">
              {activeAppt ? activeAppt.patient?.fullName : 'Cabin Idle'}
            </span>
          </Card>

          {/* Card 2: NEXT IN LINE */}
          <Card className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
              Next In Line
            </span>
            <div className="text-2xl font-black text-slate-900 tabular-nums mt-1">
              {nextUp?.tokenNumber != null ? `#${nextUp.tokenNumber}` : '—'}
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-0.5 truncate">
              {nextUp ? (nextUp.status === 'CHECKED_IN' ? 'In Waiting Room' : 'Awaiting check-in') : 'Queue Clear'}
            </span>
          </Card>

          {/* Card 3: WAITING IN CLINIC */}
          <Card className="bg-white rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide block">
              Waiting in Clinic
            </span>
            <div className="text-2xl font-black text-amber-800 tabular-nums mt-1">{waitingCount}</div>
            <span className="text-[11px] text-amber-600 block mt-0.5">Checked in & ready</span>
          </Card>

          {/* Card 4: QUEUE PACE & SCHEDULE STATUS (Estimated Ahead / Behind) */}
          <Card className={cn('bg-white rounded-2xl border p-4 shadow-xs', queuePace.bgCls)}>
            <div className="flex items-center justify-between">
              <span className={cn('text-[11px] font-bold uppercase tracking-wide block', queuePace.textCls)}>
                Est. Pace & Schedule
              </span>
              <Timer className={cn('w-3.5 h-3.5', queuePace.textCls)} />
            </div>
            <div className={cn('text-2xl font-black tabular-nums mt-1', queuePace.textCls)}>
              {queuePace.label}
            </div>
            <span className={cn('text-[11px] block mt-0.5 font-medium', queuePace.textCls)}>
              {queuePace.badge} • ~15m pace
            </span>
          </Card>
        </div>

        {/* ── Spotlight: Now Serving vs Next Up ── */}
        <div className="grid md:grid-cols-12 gap-5">
          {/* NOW SERVING BOARD (7 cols) */}
          <Card className="md:col-span-7 bg-white rounded-3xl border-2 border-blue-600 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
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
                      {activeAppt.checkedInAt && (
                        <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md text-[11px]">
                          <UserCheck className="w-3 h-3 text-blue-600" />
                          <span>Checked In: {formatTime(activeAppt.checkedInAt)}</span>
                        </span>
                      )}
                    </div>

                    {(activeAppt.patient?.basicHealthInfo || activeAppt.reasonForVisit) && (
                      <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold text-slate-700">Health info:</span>{' '}
                        {activeAppt.patient?.basicHealthInfo || activeAppt.reasonForVisit}
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
                        ? `${stillArrivingCount} patient(s) expected today. Awaiting front desk check-in.`
                        : 'All patient consultations completed for this date.'}
                  </p>
                </div>
              )}
            </div>

            {/* Doctor Clinical Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              {activeAppt ? (
                <>
                  <div className="text-xs text-slate-500 font-medium">
                    {waitingCount} patient(s) waiting after this token
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setPrescriptionAppt(activeAppt)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Write / Edit Rx</span>
                    </Button>

                    <Button
                      onClick={() => handleAction(activeAppt.id, 'complete')}
                      disabled={!!loadingId}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      {loadingId === `${activeAppt.id}-complete` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCheck className="w-4 h-4" />
                      )}
                      Mark Consultation Complete
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleAction(activeAppt.id, 'no-show')}
                      disabled={!!loadingId}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 cursor-pointer"
                    >
                      No Show
                    </Button>
                  </div>
                </>
              ) : nextUp && nextUp.status === 'CHECKED_IN' ? (
                <div className="w-full flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 font-medium">
                    Ready to call:{' '}
                    <span className="font-bold text-slate-900">{nextUp.patient?.fullName}</span> (Token #
                    {String(nextUp.tokenNumber || 1).padStart(2, '0')})
                  </div>
                  <Button
                    onClick={() => handleAction(nextUp.id, 'start-consultation')}
                    disabled={!!loadingId}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {loadingId === `${nextUp.id}-start-consultation` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlayCircle className="w-4 h-4" />
                    )}
                    Call Next Token (#{String(nextUp.tokenNumber || 1).padStart(2, '0')})
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Queue is idle. Waiting for patient arrival.</div>
              )}
            </div>
          </Card>

          {/* NEXT IN LINE BOARD (5 cols) */}
          <Card className="md:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Next In Line</span>
                {nextUp && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border-0',
                      nextUp.status === 'CHECKED_IN'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800',
                    )}
                  >
                    {nextUp.status === 'CHECKED_IN' ? 'In Waiting Room' : 'Expected'}
                  </Badge>
                )}
              </div>

              {nextUp ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        'w-14 h-14 rounded-2xl text-white flex flex-col items-center justify-center flex-shrink-0 shadow-xs',
                        nextUp.status === 'CHECKED_IN' ? 'bg-amber-500' : 'bg-slate-700',
                      )}
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
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Current Status:</span>
                      <span className="font-bold text-slate-800">
                        {nextUp.status === 'CHECKED_IN' ? (
                          <span className="text-amber-800 flex items-center gap-1 font-bold">
                            Waiting in clinic
                            {nextUp.checkedInAt && ` • In: ${formatTime(nextUp.checkedInAt)}`}
                          </span>
                        ) : (
                          'Not checked in yet'
                        )}
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
                  <Button
                    onClick={() => handleAction(nextUp.id, 'start-consultation')}
                    disabled={!!loadingId}
                    className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {loadingId === `${nextUp.id}-start-consultation` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="w-3.5 h-3.5" />
                    )}
                    Start Consultation with Token #{String(nextUp.tokenNumber || 1).padStart(2, '0')}
                  </Button>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 rounded-xl py-2.5 text-xs font-semibold border border-slate-200">
                    <UserCheck className="w-4 h-4 text-slate-400" />
                    <span>Awaiting Front-Desk Check-In</span>
                  </div>
                )}
              </div>
            )}
          </Card>
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
              <Card className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
                <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No appointments scheduled for this date</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {orderedQueue.map((appt, idx) => {
                  const ss = STATUS_STYLE[appt.status] || STATUS_STYLE.CONFIRMED;
                  const acts = ACTIONS[appt.status] || [];
                  const isAct = appt.status === 'IN_CONSULTATION';
                  const isCI = appt.status === 'CHECKED_IN';
                  const isDone = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status);

                  return (
                    <Card
                      key={appt.id}
                      className={cn(
                        'rounded-2xl border transition-all duration-150 overflow-hidden bg-white p-0 shadow-none',
                        isAct
                          ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-xs'
                          : isCI
                            ? 'border-amber-300 shadow-xs'
                            : isDone
                              ? 'border-slate-200/60 bg-slate-50/50 opacity-70'
                              : 'border-slate-200 hover:border-slate-300 shadow-xs',
                      )}
                    >
                      <div className="flex items-stretch flex-col sm:flex-row">
                        {/* Token Badge */}
                        <div
                          className={cn(
                            'w-full sm:w-16 flex-shrink-0 flex sm:flex-col items-center justify-between sm:justify-center px-4 py-2 sm:py-3.5 border-b sm:border-b-0 sm:border-r',
                            isAct
                              ? 'bg-blue-700 border-blue-800 text-white'
                              : isCI
                                ? 'bg-amber-500 border-amber-600 text-white'
                                : isDone
                                  ? 'bg-slate-100 border-slate-200 text-slate-400'
                                  : 'bg-slate-50 border-slate-200 text-slate-700',
                          )}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                            Token
                          </span>
                          <span className="text-base font-black leading-none sm:mt-0.5">
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

                            <Badge
                              variant="outline"
                              className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                                ss.bg,
                                ss.text,
                                ss.border,
                              )}
                            >
                              <span className={cn('w-1.5 h-1.5 rounded-full', ss.dot)} />
                              {ss.label}
                            </Badge>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                            </span>
                            {appt.patient?.age && (
                              <span>{appt.patient.age} yrs • {appt.patient.gender}</span>
                            )}
                            {appt.patient?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {appt.patient.phone}
                              </span>
                            )}
                            {appt.checkedInAt && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px]">
                                <UserCheck className="w-3 h-3 text-amber-600" />
                                <span>Check-In: {formatTime(appt.checkedInAt)}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions Handled by Doctor */}
                        <div className="flex items-center gap-1.5 p-3 sm:pr-3.5 border-t sm:border-t-0 border-slate-100 flex-wrap justify-end">
                          {/* Prescription Button (Doctor Only: Only for Active or Completed Consultation) */}
                          {(isAct || appt.status === 'COMPLETED') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPrescriptionAppt(appt)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[#0066cc] text-xs font-semibold h-auto cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
                              <span>Prescription (Rx)</span>
                            </Button>
                          )}

                          {/* Confirmed Notice: Front-desk check-in pending */}
                          {appt.status === 'CONFIRMED' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Awaiting Receptionist Check-In</span>
                            </span>
                          )}

                          {/* Clinical Action buttons (Call into Cabin, Complete, No Show) */}
                          {acts.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {acts.map(({ action, label, icon: Icon, cls }) => {
                                const lid = `${appt.id}-${action}`;
                                const busy = loadingId === lid;
                                return (
                                  <Button
                                    key={action}
                                    onClick={() => handleAction(appt.id, action)}
                                    disabled={!!loadingId}
                                    className={cn(
                                      'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-50 h-auto cursor-pointer',
                                      cls,
                                    )}
                                  >
                                    {busy ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Icon className="w-3.5 h-3.5" />
                                    )}
                                    <span className="hidden sm:inline">{label}</span>
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Side Panels: Waiting Room & Still Arriving (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Waiting Room (Checked in by receptionist) */}
            <Card className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-xs p-0">
              <div className="px-4 py-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Waiting Room ({checkedInList.length})
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[11px] text-amber-700 font-semibold border-amber-300 bg-amber-100/60"
                >
                  In Clinic
                </Badge>
              </div>

              {checkedInList.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  No patients waiting in clinic right now.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {checkedInList.map((a, i) => (
                    <div
                      key={a.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                          {a.tokenNumber != null ? `#${a.tokenNumber}` : i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {a.patient?.fullName || 'Patient'}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>Slot: {formatTime(a.startTime)}</span>
                            {a.checkedInAt && (
                              <>
                                <span>•</span>
                                <span className="text-amber-800 font-semibold flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-amber-600" />
                                  <span>In: {formatTime(a.checkedInAt)}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(a.id, 'start-consultation')}
                        disabled={!!loadingId}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all flex-shrink-0 cursor-pointer h-7 gap-1"
                        title="Call into Cabin"
                      >
                        {loadingId === `${a.id}-start-consultation` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PlayCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Call</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Expected Today (Confirmed, awaiting front-desk check-in) */}
            <Card className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-0">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Still Arriving ({confirmedList.length})
                  </span>
                </div>
                <Badge variant="outline" className="text-[11px] text-slate-500 font-semibold border-slate-200">
                  Expected
                </Badge>
              </div>

              {confirmedList.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  No other confirmed patients for today.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {confirmedList.map((a, i) => (
                    <div
                      key={a.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {a.tokenNumber != null ? `#${a.tokenNumber}` : i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {a.patient?.fullName || 'Patient'}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>Slot: {formatTime(a.startTime)}</span>
                            {a.checkedInAt && (
                              <>
                                <span>•</span>
                                <span className="text-amber-800 font-semibold flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-amber-600" />
                                  <span>In: {formatTime(a.checkedInAt)}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg flex-shrink-0">
                        Awaiting Check-in
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ── Doctor Medical Prescription Modal ── */}
      <DoctorPrescriptionModal
        isOpen={Boolean(prescriptionAppt)}
        onClose={() => setPrescriptionAppt(null)}
        appointment={prescriptionAppt}
        onPrescriptionSaved={() => {
          toast.success('Prescription generated successfully');
          fetchAppointmentsSilent();
        }}
      />
    </div>
  );
}
