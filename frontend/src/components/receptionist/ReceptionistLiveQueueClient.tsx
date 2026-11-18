'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import { formatTime, formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import { useAppointmentSocket } from '@/hooks/useAppointmentSocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SmoothDatePicker } from '@/components/ui/smooth-date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  CheckCircle2,
  Clock,
  Hourglass,
  User,
  Check,
  Ban,
  Search,
  ChevronDown,
  RefreshCw,
  UserPlus,
  CalendarDays,
  MoreVertical,
  Loader2,
  PlayCircle,
  XCircle,
  ListOrdered,
} from 'lucide-react';

type ActionType = 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show';

interface ReceptionistDoctorInfo {
  id?: string;
  fullName?: string;
  specialization?: string;
}

interface ReceptionistLiveQueueClientProps {
  initialAppointments: Appointment[];
  doctor: ReceptionistDoctorInfo | null;
  selectedDate: string;
  todayIST?: string;
}

export function ReceptionistLiveQueueClient({
  initialAppointments,
  doctor,
  selectedDate,
}: ReceptionistLiveQueueClientProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState<string>(selectedDate);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  const [prevInitialAppts, setPrevInitialAppts] = useState(initialAppointments);

  if (selectedDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedDate);
    setCurrentDate(selectedDate);
  }

  if (initialAppointments !== prevInitialAppts) {
    setPrevInitialAppts(initialAppointments);
    setAppointments(initialAppointments);
  }

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WAITING' | 'ARRIVING' | 'COMPLETED' | 'NO_SHOW'>('ALL');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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

  // Fetch Queue for a specific date
  const fetchQueueForDate = useCallback(
    async (targetDate: string, silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const res = await clientAxios.get(`/api/receptionist/queue?date=${targetDate}`);
        const data = res.data?.data || [];
        setAppointments(Array.isArray(data) ? data : []);
        if (!silent) toast.success(`Queue refreshed for ${formatDate(targetDate)}`);
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
    setActiveMenuId(null);
    try {
      const res = await clientAxios.post(
        `/api/receptionist/appointments/${appointmentId}/action?action=${action}`,
      );
      const labels: Record<ActionType, string> = {
        'manual-check-in': 'Patient Checked In (Waiting in Clinic)',
        'start-consultation': 'Consultation Started (Now In Cabin)',
        complete: 'Consultation Completed',
        'no-show': 'Marked as No Show',
      };
      toast.success(labels[action] || 'Queue updated');

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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || error.message || 'Action failed');
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || 'Cancellation failed');
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || 'Reschedule failed');
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
      toast.success('Walk-in patient added to live queue!');
      setIsWalkInOpen(false);
      setWalkInName('');
      setWalkInPhone('');
      setWalkInAge('');
      setWalkInReason('');
      await fetchQueue(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || 'Failed to book walk-in patient');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // KPIs
  const total = appointments.length;
  const completedList = useMemo(
    () => appointments.filter((a) => a.status === 'COMPLETED'),
    [appointments],
  );
  const completedCount = completedList.length;

  const waitingList = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'CHECKED_IN')
        .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999)),
    [appointments],
  );
  const waitingCount = waitingList.length;

  const noShowList = useMemo(
    () => appointments.filter((a) => a.status === 'NO_SHOW'),
    [appointments],
  );
  const noShowCount = noShowList.length;

  // Currently Consulting
  const inConsult = useMemo(
    () => appointments.find((a) => a.status === 'IN_CONSULTATION') || null,
    [appointments],
  );

  // Expected
  const expectedList = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'CONFIRMED')
        .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999)),
    [appointments],
  );

  // Next Patient in Line
  const nextInLine = useMemo(() => {
    return waitingList[0] || expectedList[0] || null;
  }, [waitingList, expectedList]);

  // Queue List Filtered
  const filteredQueue = useMemo(() => {
    return appointments
      .filter((a) => {
        // Tab filter
        if (filterTab === 'WAITING' && a.status !== 'CHECKED_IN') return false;
        if (filterTab === 'ARRIVING' && a.status !== 'CONFIRMED') return false;
        if (filterTab === 'COMPLETED' && a.status !== 'COMPLETED') return false;
        if (filterTab === 'NO_SHOW' && a.status !== 'NO_SHOW') return false;
        // In All view, hide rescheduled / cancelled past records
        if (filterTab === 'ALL' && ['CANCELLED', 'RESCHEDULED'].includes(a.status)) return false;

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const name = a.patient?.fullName?.toLowerCase() || '';
        const phone = a.patient?.phone || '';
        const token = String(a.tokenNumber || '');
        const status = a.status.toLowerCase();
        return name.includes(q) || phone.includes(q) || token.includes(q) || status.includes(q);
      })
      .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999));
  }, [appointments, filterTab, searchQuery]);

  return (
    <div className="space-y-6 pb-14 text-slate-900">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*                       1. TOP HEADER SECTION                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900">
              Live Patient Queue
            </h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border',
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500',
                )}
              />
              {isConnected ? 'Live Sync' : 'Connecting'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage patient flow and keep your clinic running smoothly
          </p>
        </div>

        {/* Date Selector & Walk-in Action */}
        <div className="flex items-center gap-3">
          <SmoothDatePicker
            value={currentDate}
            onChange={handleDateChange}
            className="w-auto min-w-[210px] h-10 px-3.5 rounded-2xl border-slate-200/90 bg-white text-xs font-semibold shadow-2xs hover:border-blue-400"
          />
          <Button
            type="button"
            onClick={() => setIsWalkInOpen(true)}
            className="h-10 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>+ Walk-in Patient</span>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Patients */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-100/70 text-[#0066cc] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 block">
                Total Patients
              </span>
              <div className="text-2xl sm:text-[26px] font-black text-slate-900 leading-tight mt-0.5">
                {total}
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                <span>↑ +1 vs yesterday</span>
              </span>
            </div>
          </div>
          {/* Mini Blue Sparkline Wave */}
          <div className="w-16 h-8 text-blue-500 shrink-0 self-end mb-1">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 70 30" fill="none">
              <defs>
                <linearGradient id="blueSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 0 24 C 20 24, 30 14, 45 18 C 55 22, 60 8, 70 6 L 70 30 L 0 30 Z" fill="url(#blueSpark)" />
              <path d="M 0 24 C 20 24, 30 14, 45 18 C 55 22, 60 8, 70 6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Completed Today */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 block">
                Completed Today
              </span>
              <div className="text-2xl sm:text-[26px] font-black text-slate-900 leading-tight mt-0.5">
                {completedCount}
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                <span>↑ +1 vs yesterday</span>
              </span>
            </div>
          </div>
          {/* Mini Green Sparkline Wave */}
          <div className="w-16 h-8 text-emerald-500 shrink-0 self-end mb-1">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 70 30" fill="none">
              <defs>
                <linearGradient id="greenSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 0 22 C 15 22, 28 26, 42 16 C 52 8, 60 12, 70 6 L 70 30 L 0 30 Z" fill="url(#greenSpark)" />
              <path d="M 0 22 C 15 22, 28 26, 42 16 C 52 8, 60 12, 70 6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 3: Waiting in Clinic */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 block">
                Waiting in Clinic
              </span>
              <div className="text-2xl sm:text-[26px] font-black text-slate-900 leading-tight mt-0.5">
                {waitingCount}
              </div>
              <span className="text-[11px] font-normal text-slate-400 block mt-0.5">
                Currently waiting
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: No Show */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-100/70 text-purple-600 flex items-center justify-center shrink-0">
              <Hourglass className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 block">
                No Show
              </span>
              <div className="text-2xl sm:text-[26px] font-black text-slate-900 leading-tight mt-0.5">
                {noShowCount}
              </div>
              <span className="text-[11px] font-normal text-slate-400 block mt-0.5">
                Today
              </span>
            </div>
          </div>
          {/* Mini Purple Sparkline Wave */}
          <div className="w-16 h-8 text-purple-500 shrink-0 self-end mb-1">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 70 30" fill="none">
              <defs>
                <linearGradient id="purpleSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 0 25 C 20 25, 35 22, 50 18 C 60 15, 65 20, 70 14 L 70 30 L 0 30 Z" fill="url(#purpleSpark)" />
              <path d="M 0 25 C 20 25, 35 22, 50 18 C 60 15, 65 20, 70 14" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*                       3. MAIN QUEUE CONTENT                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* ── CARD A: CURRENTLY CONSULTING ── */}
        <div className="rounded-3xl border border-blue-100/90 bg-white overflow-hidden shadow-xs">
          {/* Top Blue Gradient Banner Header */}
          <div className="bg-gradient-to-r from-[#0066cc] via-[#1a7ae0] to-[#3b8ef0] px-6 py-3.5 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-sm tracking-tight">Currently Consulting</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 border border-emerald-300/30 text-xs font-semibold backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              <span>Consultation in Progress</span>
            </div>
          </div>

          {/* Inner Content Area */}
          <div className="p-6 relative bg-gradient-to-r from-white via-white to-blue-50/30">
            {inConsult ? (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left: Token Box + Patient Info */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  {/* Large Token Badge */}
                  <div className="w-28 h-28 rounded-2xl bg-[#f0f6ff] border border-blue-100/90 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                    <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase">
                      TOKEN
                    </span>
                    <span className="text-4xl font-black text-[#0066cc] mt-0.5 leading-none">
                      {inConsult.tokenNumber != null ? `#${inConsult.tokenNumber}` : '—'}
                    </span>
                  </div>

                  {/* Patient Information */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500 shrink-0" />
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        {inConsult.patient?.fullName || 'Patient'}
                      </h3>
                    </div>

                    {(inConsult.patient?.age || inConsult.patient?.gender) && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          {[
                            inConsult.patient?.age ? `${inConsult.patient.age} yrs` : null,
                            inConsult.patient?.gender || null,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>
                        {formatTime(inConsult.startTime)} – {formatTime(inConsult.endTime)}
                      </span>
                    </div>

                    {inConsult.checkedInAt && (
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-200/80 px-3 py-1 text-xs font-semibold text-sky-700">
                          <Check className="h-3 w-3 text-sky-600" />
                          <span>
                            Checked In: {formatTime(inConsult.checkedInAt)}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-2.5 w-full lg:w-48 shrink-0">
                  <Button
                    onClick={() => handleAction(inConsult.id, 'complete')}
                    disabled={loadingId === `${inConsult.id}-complete`}
                    className="w-full h-11 rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold text-xs gap-2 shadow-sm cursor-pointer"
                  >
                    {loadingId === `${inConsult.id}-complete` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Mark as Complete</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleAction(inConsult.id, 'no-show')}
                    disabled={loadingId === `${inConsult.id}-no-show`}
                    className="w-full h-11 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border-slate-200 font-semibold text-xs gap-2 cursor-pointer shadow-2xs"
                  >
                    <Ban className="h-4 w-4 text-slate-500" />
                    <span>Mark as No Show</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-slate-100 flex flex-col items-center justify-center shrink-0 text-slate-400">
                    <span className="text-[10px] font-bold uppercase">Token</span>
                    <span className="text-2xl font-bold">—</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Doctor cabin is currently available
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {waitingCount > 0
                        ? `${waitingCount} patient(s) waiting in clinic. Call the next patient to begin.`
                        : 'No consultation in progress. Ready for patient arrivals.'}
                    </p>
                  </div>
                </div>

                {nextInLine && nextInLine.status === 'CHECKED_IN' && (
                  <Button
                    onClick={() => handleAction(nextInLine.id, 'start-consultation')}
                    disabled={loadingId === `${nextInLine.id}-start-consultation`}
                    className="h-11 px-6 rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold text-xs gap-2 shrink-0 cursor-pointer shadow-sm"
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span>Call Token #{nextInLine.tokenNumber || '1'}</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CARD B: NEXT PATIENT STRIP ── */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Next Patient
            </span>
          </div>

          {nextInLine ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-blue-50 border border-blue-100 text-[#0066cc] font-extrabold text-sm shrink-0">
                  {nextInLine.tokenNumber != null ? `#${nextInLine.tokenNumber}` : '—'}
                </span>

                <div className="flex items-center gap-3 text-xs text-slate-700 font-medium truncate flex-wrap">
                  <span className="flex items-center gap-1.5 font-bold text-slate-900">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {nextInLine.patient?.fullName || 'Patient'}
                  </span>

                  {(nextInLine.patient?.age || nextInLine.patient?.gender) && (
                    <>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span>
                        {[
                          nextInLine.patient?.age ? `${nextInLine.patient.age} yrs` : null,
                          nextInLine.patient?.gender || null,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </span>
                    </>
                  )}

                  {nextInLine.startTime && (
                    <>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {formatTime(nextInLine.startTime)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                    nextInLine.status === 'CHECKED_IN'
                      ? 'bg-amber-50 border border-amber-200 text-amber-800'
                      : 'bg-blue-50 border border-blue-200/70 text-blue-700',
                  )}
                >
                  <Clock
                    className={cn(
                      'h-3.5 w-3.5',
                      nextInLine.status === 'CHECKED_IN' ? 'text-amber-600' : 'text-blue-500',
                    )}
                  />
                  <span>
                    {nextInLine.status === 'CHECKED_IN'
                      ? 'Waiting in Clinic'
                      : 'Expected Soon'}
                  </span>
                </span>

                {nextInLine.status === 'CHECKED_IN' ? (
                  <Button
                    size="sm"
                    onClick={() => handleAction(nextInLine.id, 'start-consultation')}
                    disabled={loadingId === `${nextInLine.id}-start-consultation`}
                    className="h-8 rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold px-3 cursor-pointer"
                  >
                    Call Cabin
                  </Button>
                ) : nextInLine.status === 'CONFIRMED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(nextInLine.id, 'manual-check-in')}
                    disabled={loadingId === `${nextInLine.id}-manual-check-in`}
                    className="h-8 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 px-3 cursor-pointer"
                  >
                    Check In
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs">
                  —
                </span>
                <span>No upcoming patient remaining in queue.</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Queue is clear</span>
            </div>
          )}
        </div>

        {/* ── CARD C: QUEUE LIST TABLE ── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          {/* Table Header Row: Title on Left, Search + Filter on Right */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-slate-700" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Queue List
              </h3>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search patient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-4 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all w-44 sm:w-56"
                />
              </div>

              {/* Filter Dropdown */}
              <div className="relative">
                <select
                  value={filterTab}
                  onChange={(e) =>
                    setFilterTab(
                      e.target.value as 'ALL' | 'WAITING' | 'ARRIVING' | 'COMPLETED' | 'NO_SHOW',
                    )
                  }
                  className="h-9 px-3.5 pr-8 rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-blue-500 cursor-pointer appearance-none"
                >
                  <option value="ALL">All Tokens</option>
                  <option value="WAITING">Waiting in Clinic</option>
                  <option value="ARRIVING">Expected</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Token</th>
                  <th className="pb-3">Patient Name</th>
                  <th className="pb-3">Age / Gender</th>
                  <th className="pb-3">Appointment Time</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No appointments found matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((appt, idx) => {
                    const isWaiting = appt.status === 'CHECKED_IN';
                    const isConsulting = appt.status === 'IN_CONSULTATION';
                    const isDone = appt.status === 'COMPLETED';
                    const isConfirmed = appt.status === 'CONFIRMED';
                    const isNoShow = appt.status === 'NO_SHOW';
                    const isRescheduled = appt.status === 'RESCHEDULED';
                    const isCancelled = appt.status === 'CANCELLED';

                    return (
                      <tr
                        key={appt.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* Token Column */}
                        <td className="py-3 pl-2">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100">
                            #{appt.tokenNumber != null ? appt.tokenNumber : idx + 1}
                          </span>
                        </td>

                        {/* Patient Name */}
                        <td className="py-3">
                          <span className="font-bold text-slate-900 text-sm">
                            {appt.patient?.fullName || 'Patient'}
                          </span>
                        </td>

                        {/* Age / Gender */}
                        <td className="py-3 text-slate-600">
                          {appt.patient?.age ? `${appt.patient.age} yrs` : '—'} •{' '}
                          {appt.patient?.gender || '—'}
                        </td>

                        {/* Appointment Time */}
                        <td className="py-3 text-slate-700 font-medium">
                          {formatTime(appt.startTime)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3">
                          {isConsulting && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-200/80">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                              <span>In Consult</span>
                            </span>
                          )}
                          {isWaiting && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-medium text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                              <span>Waiting</span>
                            </span>
                          )}
                          {isDone && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              <span>Completed</span>
                            </span>
                          )}
                          {isConfirmed && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 font-medium text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                              <span>Expected</span>
                            </span>
                          )}
                          {isNoShow && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                              <span>No Show</span>
                            </span>
                          )}
                          {isRescheduled && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              <span>Rescheduled</span>
                            </span>
                          )}
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 font-medium text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                              <span>Cancelled</span>
                            </span>
                          )}
                        </td>

                        {/* Action Menu (3 Dots) */}
                        <td className="py-3 text-right pr-2">
                          <Popover
                            open={activeMenuId === appt.id}
                            onOpenChange={(open) => setActiveMenuId(open ? appt.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 inline-flex items-center justify-center transition-colors cursor-pointer"
                                title="Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="w-48 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-0.5 text-xs font-semibold"
                            >
                              {isWaiting && (
                                <button
                                  type="button"
                                  onClick={() => handleAction(appt.id, 'start-consultation')}
                                  className="w-full text-left px-3 py-2 rounded-xl text-blue-700 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <PlayCircle className="h-4 w-4 text-blue-600" />
                                  <span>Call to Cabin</span>
                                </button>
                              )}

                              {!isWaiting && !isConsulting && !isDone && (
                                <button
                                  type="button"
                                  onClick={() => handleAction(appt.id, 'manual-check-in')}
                                  className="w-full text-left px-3 py-2 rounded-xl text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <Check className="h-4 w-4 text-emerald-600" />
                                  <span>Check In Patient</span>
                                </button>
                              )}

                              {isConsulting && (
                                <button
                                  type="button"
                                  onClick={() => handleAction(appt.id, 'complete')}
                                  className="w-full text-left px-3 py-2 rounded-xl text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <Check className="h-4 w-4 text-emerald-600" />
                                  <span>Mark Complete</span>
                                </button>
                              )}

                              {!isDone && (
                                <button
                                  type="button"
                                  onClick={() => handleAction(appt.id, 'no-show')}
                                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <Ban className="h-4 w-4 text-slate-400" />
                                  <span>Mark No Show</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleTarget(appt);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <CalendarDays className="h-4 w-4 text-slate-400" />
                                <span>Reschedule</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCancelTarget(appt);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                              >
                                <XCircle className="h-4 w-4 text-rose-500" />
                                <span>Cancel</span>
                              </button>
                            </PopoverContent>
                          </Popover>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*                       4. INTERACTIVE MODALS                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}

      {/* WALK-IN PATIENT MODAL */}
      <Dialog open={isWalkInOpen} onOpenChange={setIsWalkInOpen}>
    <DialogContent className="sm:max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-[#0066cc]" />
          <span>Add Walk-in Patient</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500">
          Immediately adds patient to today&apos;s queue and assigns next token.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleWalkIn} className="space-y-4 pt-2">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Full Name *
          </label>
          <Input
            placeholder="e.g. Ramesh Sharma"
            value={walkInName}
            onChange={(e) => setWalkInName(e.target.value)}
            required
            className="h-10 rounded-xl border-slate-200 text-xs"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Phone Number *
          </label>
          <Input
            placeholder="10-digit mobile number"
            value={walkInPhone}
            onChange={(e) => setWalkInPhone(e.target.value)}
            required
            className="h-10 rounded-xl border-slate-200 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Age</label>
            <Input
              type="number"
              placeholder="e.g. 34"
              value={walkInAge}
              onChange={(e) => setWalkInAge(e.target.value)}
              className="h-10 rounded-xl border-slate-200 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Gender</label>
            <select
              value={walkInGender}
              onChange={(e) => setWalkInGender(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Reason / Chief Complaint
          </label>
          <Input
            placeholder="e.g. High fever, headache"
            value={walkInReason}
            onChange={(e) => setWalkInReason(e.target.value)}
            className="h-10 rounded-xl border-slate-200 text-xs"
          />
        </div>

        <DialogFooter className="pt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsWalkInOpen(false)}
            className="rounded-xl border-slate-200 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={walkInSubmitting}
            className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold px-4"
          >
            {walkInSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Add'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  {/* RESCHEDULE MODAL */ }
  <Dialog
    open={Boolean(rescheduleTarget)}
    onOpenChange={(open) => !open && setRescheduleTarget(null)}
  >
    <DialogContent className="sm:max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[#0066cc]" />
          <span>Reschedule Appointment</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500">
          Change date and time slot for {rescheduleTarget?.patient?.fullName}.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleReschedule} className="space-y-4 pt-2">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">New Date</label>
          <Input
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            required
            className="h-10 rounded-xl border-slate-200 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Start Time</label>
            <Input
              type="time"
              value={rescheduleStartTime}
              onChange={(e) => setRescheduleStartTime(e.target.value)}
              required
              className="h-10 rounded-xl border-slate-200 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">End Time</label>
            <Input
              type="time"
              value={rescheduleEndTime}
              onChange={(e) => setRescheduleEndTime(e.target.value)}
              required
              className="h-10 rounded-xl border-slate-200 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Reason for Rescheduling
          </label>
          <Input
            placeholder="e.g. Patient requested morning slot"
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            className="h-10 rounded-xl border-slate-200 text-xs"
          />
        </div>

        <DialogFooter className="pt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setRescheduleTarget(null)}
            className="rounded-xl border-slate-200 text-xs font-semibold"
          >
            Close
          </Button>
          <Button
            type="submit"
            disabled={rescheduling}
            className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold px-4"
          >
            {rescheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Reschedule'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  {/* CANCEL MODAL */ }
  <Dialog
    open={Boolean(cancelTarget)}
    onOpenChange={(open) => !open && setCancelTarget(null)}
  >
    <DialogContent className="sm:max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl">
      <DialogHeader>
        <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2 text-rose-600">
          <XCircle className="h-5 w-5 text-rose-600" />
          <span>Cancel Appointment?</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-500">
          Are you sure you want to cancel the appointment for{' '}
          <strong className="text-slate-800">{cancelTarget?.patient?.fullName}</strong>?
          This action cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="pt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCancelTarget(null)}
          className="rounded-xl border-slate-200 text-xs font-semibold"
        >
          Keep Appointment
        </Button>
        <Button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4"
        >
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Cancel'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
    </div >
  );
}

export default ReceptionistLiveQueueClient;
