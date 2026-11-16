'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import { formatTime, formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import { useAppointmentSocket } from '@/hooks/useAppointmentSocket';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SmoothDatePicker } from '@/components/ui/smooth-date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Search,
  CheckCircle2,
  Radio,
  UserPlus,
  XCircle,
} from 'lucide-react';

type ActionType = 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show';

const STATUS_STYLE: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  CONFIRMED:       { label: 'Confirmed',       dot: 'bg-sky-500',     text: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-200' },
  CHECKED_IN:      { label: 'In Waiting Room', dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  IN_CONSULTATION: { label: 'In Consult',      dot: 'bg-blue-600 animate-pulse', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  COMPLETED:       { label: 'Completed',       dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  CANCELLED:       { label: 'Cancelled',       dot: 'bg-rose-400',    text: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200' },
  NO_SHOW:         { label: 'No Show',         dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',   border: 'border-slate-200' },
};

interface ReceptionistLiveQueueClientProps {
  initialAppointments: Appointment[];
  doctor: any;
  selectedDate: string;
  todayIST: string;
}

export function ReceptionistLiveQueueClient({
  initialAppointments,
  doctor,
  selectedDate,
  todayIST,
}: ReceptionistLiveQueueClientProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState<string>(selectedDate);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'WAITING' | 'ARRIVING' | 'COMPLETED'>('ALL');

  // Walk-in modal state
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInGender, setWalkInGender] = useState('MALE');
  const [walkInReason, setWalkInReason] = useState('');

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(selectedDate);
  const [rescheduleStartTime, setRescheduleStartTime] = useState('10:00');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('10:15');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Sync props when SSR/URL changes
  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  // Fetch Queue for a specific date
  const fetchQueueForDate = useCallback(
    async (targetDate: string, silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await clientAxios.get(`/api/receptionist/queue?date=${targetDate}`);
        const data = res.data?.data || [];
        setAppointments(Array.isArray(data) ? data : []);
        if (!silent) toast.success(`Queue loaded for ${targetDate}`);
      } catch {
        if (!silent) toast.error('Failed to load queue for date');
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [],
  );

  const fetchQueue = useCallback(
    async (silent = false) => {
      return fetchQueueForDate(currentDate, silent);
    },
    [currentDate, fetchQueueForDate],
  );

  // Real-time WebSocket synchronization
  const { isConnected } = useAppointmentSocket({
    role: 'doctor',
    profileId: doctor?.id,
    onEvent: (event) => {
      if (
        event === 'queue.updated' ||
        event === 'doctor.status.board' ||
        event === 'appointment.updated' ||
        event === 'appointment.created' ||
        event === 'appointment.cancelled'
      ) {
        fetchQueue(true);
      }
    },
  });

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    setCurrentDate(newDate);
    fetchQueueForDate(newDate);
    router.replace(`/receptionist/queue?date=${newDate}`, { scroll: false });
  };

  const handleAction = async (appointmentId: string, action: ActionType) => {
    const lid = `${appointmentId}-${action}`;
    setLoadingId(lid);
    try {
      const res = await clientAxios.post(
        `/api/receptionist/appointments/${appointmentId}/action?action=${action}`,
      );
      const labels: Record<ActionType, string> = {
        'manual-check-in': 'Patient Checked In (Waiting in Clinic)',
        'start-consultation': 'Consultation Started (Now Serving)',
        complete: 'Consultation Completed',
        'no-show': 'Marked as No Show',
      };
      toast.success(labels[action] || 'Queue updated');

      // Record check-in timestamp locally immediately
      if (action === 'manual-check-in') {
        const checkInTime = res?.data?.checkedInAt || new Date().toISOString();
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === appointmentId
              ? { ...a, status: 'CHECKED_IN', checkedInAt: checkInTime }
              : a,
          ),
        );
      }
      await fetchQueue(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Action failed');
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await clientAxios.patch(`/api/receptionist/appointments/${cancelTarget.id}/cancel`);
      toast.success('Appointment cancelled successfully');
      setCancelTarget(null);
      await fetchQueue(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    setRescheduling(true);
    try {
      await clientAxios.patch(
        `/api/receptionist/appointments/${rescheduleTarget.id}/reschedule`,
        {
          date: rescheduleDate,
          startTime: rescheduleStartTime,
          endTime: rescheduleEndTime,
          rescheduleReason: rescheduleReason || undefined,
        },
      );
      toast.success('Appointment rescheduled successfully');
      setRescheduleTarget(null);
      await fetchQueue(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Reschedule failed');
    } finally {
      setRescheduling(false);
    }
  };

  const handleWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim() || !walkInPhone.trim()) {
      toast.error('Patient name and phone are required');
      return;
    }
    setWalkInSubmitting(true);
    try {
      await clientAxios.post('/api/receptionist/appointments/walk-in', {
        fullName: walkInName.trim(),
        phone: walkInPhone.trim(),
        age: walkInAge ? parseInt(walkInAge, 10) : undefined,
        gender: walkInGender,
        reason: walkInReason.trim() || undefined,
      });
      toast.success('Walk-in patient booked & added to live queue!');
      setIsWalkInOpen(false);
      setWalkInName('');
      setWalkInPhone('');
      setWalkInAge('');
      setWalkInReason('');
      await fetchQueue(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to book walk-in patient');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // KPIs
  const total = appointments.length;
  const inConsult = appointments.find((a) => a.status === 'IN_CONSULTATION');
  const waitingList = appointments
    .filter((a) => a.status === 'CHECKED_IN')
    .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
  const waitingCount = waitingList.length;

  const expectedList = appointments
    .filter((a) => a.status === 'CONFIRMED')
    .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
  const expectedCount = expectedList.length;

  const completedList = appointments
    .filter((a) => a.status === 'COMPLETED')
    .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
  const completedCount = completedList.length;

  // Next patient in line (first checked-in waiting, or first confirmed if none checked in)
  const nextInLine = waitingList[0] || expectedList[0] || null;

  // Ordered queue for sequential display (Now serving first, then checked in, then confirmed, then done)
  const otherList = appointments.filter((a) => ['CANCELLED', 'NO_SHOW'].includes(a.status));
  const orderedAppointments = useMemo(() => {
    return [
      ...(inConsult ? [inConsult] : []),
      ...waitingList,
      ...expectedList,
      ...completedList,
      ...otherList,
    ];
  }, [inConsult, waitingList, expectedList, completedList, otherList]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return orderedAppointments.filter((a) => {
      // Tab filter
      if (activeTab === 'WAITING' && a.status !== 'CHECKED_IN') return false;
      if (activeTab === 'ARRIVING' && a.status !== 'CONFIRMED') return false;
      if (activeTab === 'COMPLETED' && a.status !== 'COMPLETED') return false;

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = a.patient?.fullName?.toLowerCase() || '';
      const phone = a.patient?.phone || '';
      const token = String(a.tokenNumber || '');
      return name.includes(q) || phone.includes(q) || token.includes(q);
    });
  }, [orderedAppointments, activeTab, searchQuery]);

  return (
    <div className="space-y-6 pb-16">
      {/* ─── Top Control Bar: Doctor & Date & Realtime Indicator ─── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Live Patient Queue
            </h1>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full border gap-1 inline-flex items-center',
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
              )}
            >
              <Radio
                className={cn(
                  'h-3 w-3',
                  isConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500',
                )}
              />
              <span>{isConnected ? 'Real-Time Sync Active' : 'Connecting Sync...'}</span>
            </Badge>
          </div>
          <p className="text-xs text-slate-600 flex items-center gap-1.5">
            <span>Managing front-desk for</span>
            <strong className="text-slate-900">Dr. {doctor?.fullName || 'Doctor'}</strong>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">{doctor?.specialization || 'Clinical Practice'}</span>
          </p>
        </div>

        {/* Date Selector & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <SmoothDatePicker
            value={currentDate}
            onChange={handleDateChange}
            className="w-40 text-xs rounded-xl"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDateChange(todayIST)}
            disabled={currentDate === todayIST}
            className={cn(
              'h-9 px-3 rounded-xl text-xs font-semibold border-slate-200 cursor-pointer',
              currentDate === todayIST
                ? 'bg-blue-50 text-[#0066cc] border-blue-200'
                : 'text-slate-700 hover:bg-slate-50',
            )}
          >
            Today
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fetchQueue(false)}
            disabled={refreshing}
            className="h-9 w-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            title="Refresh queue"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>

          <Button
            onClick={() => setIsWalkInOpen(true)}
            className="h-9 px-3.5 rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white shadow-xs text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Walk-in Patient</span>
          </Button>
        </div>
      </div>

      {/* ─── 4 Top KPI Cards (Matching Doctor Live Queue Layout Exactly) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
            Total Patients
          </span>
          <div className="text-2xl font-black text-slate-900 tabular-nums mt-1">{total}</div>
          <span className="text-[11px] text-slate-400 block mt-0.5">Scheduled on this date</span>
        </Card>

        <Card className="bg-white rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide block">
            Waiting in Clinic
          </span>
          <div className="text-2xl font-black text-amber-800 tabular-nums mt-1">{waitingCount}</div>
          <span className="text-[11px] text-amber-600 block mt-0.5">Checked in & ready</span>
        </Card>

        <Card className="bg-white rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wide block">
            Still Arriving
          </span>
          <div className="text-2xl font-black text-sky-800 tabular-nums mt-1">{expectedCount}</div>
          <span className="text-[11px] text-sky-600 block mt-0.5">Confirmed appointments</span>
        </Card>

        <Card className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide block">
            Done Today
          </span>
          <div className="text-2xl font-black text-emerald-800 tabular-nums mt-1">{completedCount}</div>
          <span className="text-[11px] text-emerald-600 block mt-0.5">Consultations completed</span>
        </Card>
      </div>

      {/* ─── Spotlight: Now Serving (7 cols) vs Next Up (5 cols) ─── */}
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

            {inConsult ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-blue-700 text-white flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Token</span>
                  <span className="text-3xl font-black leading-none mt-0.5">
                    {inConsult.tokenNumber != null ? `#${inConsult.tokenNumber}` : '—'}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xl font-bold text-slate-900 truncate">
                    {inConsult.patient?.fullName || 'Patient'}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-semibold text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatTime(inConsult.startTime)} – {formatTime(inConsult.endTime)}
                    </span>
                    {inConsult.patient?.age && (
                      <span>{inConsult.patient.age} yrs • {inConsult.patient.gender}</span>
                    )}
                    {inConsult.patient?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {inConsult.patient.phone}
                      </span>
                    )}
                    {inConsult.checkedInAt && (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md text-[11px]">
                        <UserCheck className="w-3 h-3 text-blue-600" />
                        <span>Checked In: {formatTime(inConsult.checkedInAt)}</span>
                      </span>
                    )}
                  </div>

                  {(inConsult.patient?.basicHealthInfo || inConsult.reasonForVisit) && (
                    <p className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                      <span className="font-semibold text-slate-700">Health info:</span>{' '}
                      {inConsult.patient?.basicHealthInfo || inConsult.reasonForVisit}
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
                    ? `${waitingCount} patient(s) waiting in clinic. Call the next patient to doctor cabin.`
                    : expectedCount > 0
                      ? `${expectedCount} patient(s) expected today. Awaiting check-in.`
                      : 'All patient consultations completed for this date.'}
                </p>
              </div>
            )}
          </div>

          {/* Actions / Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            {inConsult ? (
              <>
                <div className="text-xs text-slate-500 font-medium">
                  {waitingCount} patient(s) waiting after this token
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleAction(inConsult.id, 'complete')}
                    disabled={loadingId === `${inConsult.id}-complete`}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {loadingId === `${inConsult.id}-complete` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCheck className="w-4 h-4" />
                    )}
                    <span>Mark Consultation Complete</span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleAction(inConsult.id, 'no-show')}
                    disabled={loadingId === `${inConsult.id}-no-show`}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    No Show
                  </Button>
                </div>
              </>
            ) : nextInLine && nextInLine.status === 'CHECKED_IN' ? (
              <div className="w-full flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600 font-medium">
                  Ready to call: <span className="font-bold text-slate-900">{nextInLine.patient?.fullName}</span> (Token #{nextInLine.tokenNumber != null ? `#${nextInLine.tokenNumber}` : '—'})
                </div>
                <Button
                  onClick={() => handleAction(nextInLine.id, 'start-consultation')}
                  disabled={loadingId === `${nextInLine.id}-start-consultation`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {loadingId === `${nextInLine.id}-start-consultation` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                  <span>Call Next Token (#{nextInLine.tokenNumber != null ? nextInLine.tokenNumber : '—'})</span>
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
              {nextInLine && (
                <Badge
                  variant="outline"
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border-0 ${
                    nextInLine.status === 'CHECKED_IN'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {nextInLine.status === 'CHECKED_IN' ? 'In Waiting Room' : 'Expected'}
                </Badge>
              )}
            </div>

            {nextInLine ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-14 h-14 rounded-2xl text-white flex flex-col items-center justify-center flex-shrink-0 shadow-xs ${
                      nextInLine.status === 'CHECKED_IN' ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Token</span>
                    <span className="text-xl font-black leading-none mt-0.5">
                      {nextInLine.tokenNumber != null ? `#${nextInLine.tokenNumber}` : '—'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-base truncate">
                      {nextInLine.patient?.fullName || 'Patient'}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      Slot: {formatTime(nextInLine.startTime)} – {formatTime(nextInLine.endTime)}
                    </div>
                    {nextInLine.patient?.age && (
                      <div className="text-xs text-slate-400">
                        {nextInLine.patient.age} yrs • {nextInLine.patient.gender}
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
                        {nextInLine.status === 'CHECKED_IN' ? (
                          <span className="text-amber-800 flex items-center gap-1 font-bold">
                            Waiting in clinic
                            {nextInLine.checkedInAt && ` • In: ${formatTime(nextInLine.checkedInAt)}`}
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

          {nextInLine && (
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
              {nextInLine.status === 'CHECKED_IN' ? (
                <Button
                  onClick={() => handleAction(nextInLine.id, 'start-consultation')}
                  disabled={loadingId === `${nextInLine.id}-start-consultation`}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {loadingId === `${nextInLine.id}-start-consultation` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Call to Doctor Cabin</span>
                </Button>
              ) : (
                <Button
                  onClick={() => handleAction(nextInLine.id, 'manual-check-in')}
                  disabled={loadingId === `${nextInLine.id}-manual-check-in`}
                  className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {loadingId === `${nextInLine.id}-manual-check-in` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Check In Patient When Arrived</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setRescheduleTarget(nextInLine)}
                className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 h-10 px-3 cursor-pointer"
              >
                Reschedule
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* ─── Bottom 2-Column Layout: Sequence of Tokens (8 cols) & Side Panels (4 cols) ─── */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Sequence of Tokens (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-900">Sequence of Tokens (All Patients)</h2>
              <span className="text-xs text-slate-500 font-semibold ml-1">
                {appointments.length} Total
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                  activeTab === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                All ({appointments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('WAITING')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                  activeTab === 'WAITING'
                    ? 'bg-white text-amber-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                In Clinic ({waitingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ARRIVING')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                  activeTab === 'ARRIVING'
                    ? 'bg-white text-sky-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Expected ({expectedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('COMPLETED')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                  activeTab === 'COMPLETED'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Done ({completedCount})
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search token #, name or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-xl border-slate-200 text-xs bg-white"
            />
          </div>

          {/* Tokens List */}
          {filteredAppointments.length === 0 ? (
            <Card className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs">
              <UserX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No appointments found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery ? 'Try a different search query' : 'No patients in this category.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAppointments.map((appt, idx) => {
                const ss = STATUS_STYLE[appt.status] || STATUS_STYLE.CONFIRMED;
                const isAct = appt.status === 'IN_CONSULTATION';
                const isCI = appt.status === 'CHECKED_IN';
                const isConf = appt.status === 'CONFIRMED';
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
                            ? 'border-slate-200/60 bg-slate-50/50 opacity-75'
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
                            <span>{ss.label}</span>
                          </Badge>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                            </span>
                          </span>
                          {appt.patient?.age && (
                            <span>{appt.patient.age} yrs • {appt.patient.gender}</span>
                          )}
                          {appt.patient?.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{appt.patient.phone}</span>
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

                      {/* Operational Actions Handled by Front-Desk Receptionist */}
                      <div className="flex items-center gap-1.5 p-3 sm:pr-3.5 border-t sm:border-t-0 border-slate-100 flex-wrap justify-end">
                        {/* CONFIRMED Actions: Check In, Reschedule, Cancel */}
                        {isConf && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAction(appt.id, 'manual-check-in')}
                              disabled={loadingId === `${appt.id}-manual-check-in`}
                              className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-8 px-3 gap-1 shadow-xs cursor-pointer"
                            >
                              {loadingId === `${appt.id}-manual-check-in` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                              <span>Check In</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRescheduleTarget(appt)}
                              className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 h-8 px-2.5 cursor-pointer"
                            >
                              Reschedule
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCancelTarget(appt)}
                              className="rounded-xl text-rose-600 hover:bg-rose-50 text-xs h-8 px-2.5 cursor-pointer"
                            >
                              Cancel
                            </Button>
                          </>
                        )}

                        {/* CHECKED_IN Actions: Call Patient, Reschedule, No Show */}
                        {isCI && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAction(appt.id, 'start-consultation')}
                              disabled={loadingId === `${appt.id}-start-consultation`}
                              className="rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-8 px-3.5 gap-1.5 shadow-xs cursor-pointer"
                            >
                              {loadingId === `${appt.id}-start-consultation` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PlayCircle className="h-3.5 w-3.5" />
                              )}
                              <span>Call Patient</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRescheduleTarget(appt)}
                              className="rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 h-8 px-2.5 cursor-pointer"
                            >
                              Reschedule
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(appt.id, 'no-show')}
                              disabled={loadingId === `${appt.id}-no-show`}
                              className="rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs h-8 px-2.5 cursor-pointer"
                            >
                              No Show
                            </Button>
                          </>
                        )}

                        {/* IN_CONSULTATION Actions: Complete or No Show */}
                        {isAct && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAction(appt.id, 'complete')}
                              disabled={loadingId === `${appt.id}-complete`}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-4 gap-1.5 shadow-xs cursor-pointer"
                            >
                              {loadingId === `${appt.id}-complete` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCheck className="h-3.5 w-3.5" />
                              )}
                              <span>Complete</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction(appt.id, 'no-show')}
                              disabled={loadingId === `${appt.id}-no-show`}
                              className="rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs h-8 px-2.5 cursor-pointer"
                            >
                              No Show
                            </Button>
                          </>
                        )}

                        {/* COMPLETED Badge */}
                        {appt.status === 'COMPLETED' && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Done</span>
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

        {/* ─── Side Panels (4 cols): Waiting Room & Still Arriving ─── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Waiting Room (Checked in) */}
          <Card className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-xs p-0">
            <div className="px-4 py-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Waiting Room ({waitingList.length})
                </span>
              </div>
              <Badge
                variant="outline"
                className="text-[11px] text-amber-700 font-semibold border-amber-300 bg-amber-100/60"
              >
                In Clinic
              </Badge>
            </div>

            {waitingList.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">
                No patients waiting in clinic right now.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {waitingList.map((a, i) => (
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
                      size="icon"
                      onClick={() => handleAction(a.id, 'start-consultation')}
                      disabled={loadingId === `${a.id}-start-consultation`}
                      className="h-8 w-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all flex-shrink-0 cursor-pointer"
                      title="Call to Doctor Cabin"
                    >
                      {loadingId === `${a.id}-start-consultation` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Still Arriving (Confirmed, not yet checked in) */}
          <Card className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-0">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Still Arriving ({expectedList.length})
                </span>
              </div>
              <Badge variant="outline" className="text-[11px] text-slate-500 font-semibold border-slate-200">
                Expected
              </Badge>
            </div>

            {expectedList.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">
                No other confirmed patients for today.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {expectedList.map((a, i) => (
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

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(a.id, 'manual-check-in')}
                      disabled={loadingId === `${a.id}-manual-check-in`}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold transition-all flex-shrink-0 cursor-pointer h-7"
                    >
                      {loadingId === `${a.id}-manual-check-in` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Check In'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ─── Walk-in Booking Modal ─── */}
      <Dialog open={isWalkInOpen} onOpenChange={setIsWalkInOpen}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-xl">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-[#0066cc]">
                <UserPlus className="h-5 w-5" />
              </span>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Book Walk-in Patient
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600">
              Add a walk-in patient directly to Dr. {doctor?.fullName}&apos;s live queue for today.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWalkIn} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Patient Full Name *</label>
              <Input
                required
                placeholder="e.g. Ramesh Kumar"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Phone Number *</label>
              <Input
                required
                placeholder="e.g. 9876543210"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Age</label>
                <Input
                  type="number"
                  placeholder="e.g. 32"
                  value={walkInAge}
                  onChange={(e) => setWalkInAge(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Gender</label>
                <select
                  value={walkInGender}
                  onChange={(e) => setWalkInGender(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Consultation Reason / Chief Complaint
              </label>
              <Input
                placeholder="e.g. Fever, Blood pressure check"
                value={walkInReason}
                onChange={(e) => setWalkInReason(e.target.value)}
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWalkInOpen(false)}
                disabled={walkInSubmitting}
                className="rounded-xl border-slate-200 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={walkInSubmitting}
                className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold gap-1.5 cursor-pointer"
              >
                {walkInSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Booking...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Generate Token & Add</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Reschedule Modal ─── */}
      <Dialog
        open={Boolean(rescheduleTarget)}
        onOpenChange={(open) => !open && setRescheduleTarget(null)}
      >
        <DialogContent className="max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-xl">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Reschedule Appointment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Select a new date and time slot for{' '}
              <strong className="text-slate-900">{rescheduleTarget?.patient?.fullName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReschedule} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">New Date *</label>
              <Input
                type="date"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Start Time *</label>
                <Input
                  type="time"
                  required
                  value={rescheduleStartTime}
                  onChange={(e) => setRescheduleStartTime(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">End Time *</label>
                <Input
                  type="time"
                  required
                  value={rescheduleEndTime}
                  onChange={(e) => setRescheduleEndTime(e.target.value)}
                  className="rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Reason for Rescheduling</label>
              <Input
                placeholder="e.g. Patient requested morning slot"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleTarget(null)}
                disabled={rescheduling}
                className="rounded-xl border-slate-200 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={rescheduling}
                className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold gap-1.5 cursor-pointer"
              >
                {rescheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Confirm Reschedule</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirmation Modal ─── */}
      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent className="max-w-sm p-6 rounded-3xl bg-white border border-slate-200 shadow-xl">
          <DialogHeader className="text-left space-y-1">
            <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Cancel Appointment?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel the appointment for{' '}
              <strong className="text-slate-900">{cancelTarget?.patient?.fullName}</strong>{' '}
              (Token #{cancelTarget?.tokenNumber})? The slot will be freed in the queue.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
              className="rounded-xl border-slate-200 text-xs"
            >
              No, Keep
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold gap-1.5 cursor-pointer"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>Yes, Cancel</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
