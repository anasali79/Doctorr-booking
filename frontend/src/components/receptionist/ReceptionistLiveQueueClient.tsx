'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  CalendarDays,
  Search,
  ChevronDown,
  Check,
  UserPlus,
  MoreVertical,
  Loader2,
  RefreshCw,
  Sparkles,
  Calendar,
  AlertCircle,
  X,
} from 'lucide-react';

type ActionType = 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show';

export interface ReceptionistDoctorInfo {
  id: string;
  fullName: string;
  specialization: string;
  consultationFee?: number;
  phone?: string | null;
  currentServingToken?: number | null;
}

interface ReceptionistLiveQueueClientProps {
  initialAppointments: Appointment[];
  doctor: ReceptionistDoctorInfo | null;
  allDoctors?: ReceptionistDoctorInfo[];
  selectedDoctorId?: string;
  selectedDate: string;
  todayIST?: string;
  initialYesterdayStats?: { total: number; completed: number } | null;
}

function formatDayAndDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatSlotHourRange(startTimeStr?: string): string {
  if (!startTimeStr) return '09:00 AM – 10:00 AM';
  const parts = startTimeStr.split(':');
  let hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return '09:00 AM – 10:00 AM';

  const startHour12 = hour % 12 === 0 ? 12 : hour % 12;
  const startAmPm = hour < 12 ? 'AM' : 'PM';

  const nextHour = (hour + 1) % 24;
  const endHour12 = nextHour % 12 === 0 ? 12 : nextHour % 12;
  const endAmPm = nextHour < 12 ? 'AM' : 'PM';

  return `${startHour12}:00 ${startAmPm} – ${endHour12}:00 ${endAmPm}`;
}

function isSlotActiveNow(slotRange: string, selectedDate: string, todayIST: string): boolean {
  if (selectedDate !== todayIST) return false;
  const now = new Date();
  const currentHour = now.getHours();

  const match = slotRange.match(/(\d+):00\s*(AM|PM)/i);
  if (!match) return false;
  let slotStartHour = parseInt(match[1], 10);
  const ampm = match[2].toUpperCase();
  if (ampm === 'PM' && slotStartHour < 12) slotStartHour += 12;
  if (ampm === 'AM' && slotStartHour === 12) slotStartHour = 0;

  return currentHour === slotStartHour;
}

function getWaitingTime(appt: Appointment): string {
  if (appt.status === 'COMPLETED' || appt.status === 'CANCELLED') return '–';
  if (appt.checkedInAt) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(appt.checkedInAt).getTime()) / 60000));
    return `${minutes} min`;
  }
  if (appt.startTime) {
    const [h, m] = appt.startTime.split(':').map(Number);
    const now = new Date();
    const apptDate = new Date();
    apptDate.setHours(h || 9, m || 0, 0, 0);
    const diffMin = Math.round((now.getTime() - apptDate.getTime()) / 60000);
    if (diffMin > 0 && diffMin < 180) {
      return `${diffMin} min`;
    }
  }
  const token = appt.tokenNumber || 1;
  return `${Math.max(4, 6 + ((token * 3) % 14))} min`;
}

export function ReceptionistLiveQueueClient({
  initialAppointments,
  doctor,
  allDoctors = [],
  selectedDoctorId,
  selectedDate,
  todayIST = new Date().toISOString().split('T')[0],
  initialYesterdayStats,
}: ReceptionistLiveQueueClientProps) {
  const router = useRouter();

  // Active Doctor & Date State
  const [currentDoctor, setCurrentDoctor] = useState<ReceptionistDoctorInfo | null>(() => {
    if (doctor) return doctor;
    if (allDoctors.length > 0) return allDoctors[0];
    return null;
  });

  const [currentDate, setCurrentDate] = useState<string>(selectedDate);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [yesterdayStats, setYesterdayStats] = useState<{ total: number; completed: number } | null>(
    initialYesterdayStats || null,
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isDoctorSelectOpen, setIsDoctorSelectOpen] = useState(false);

  // Doctors list fallback
  const doctorList = useMemo(() => {
    if (allDoctors && allDoctors.length > 0) {
      // Ensure current doctor is included if not in allDoctors
      if (doctor && !allDoctors.some((d) => d.id === doctor.id)) {
        return [doctor, ...allDoctors];
      }
      return allDoctors;
    }
    if (doctor) return [doctor];
    return [];
  }, [allDoctors, doctor]);

  // Doctor search in left panel dropdown
  const [doctorSearch, setDoctorSearch] = useState('');
  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctorList;
    const q = doctorSearch.toLowerCase().trim();
    return doctorList.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q),
    );
  }, [doctorList, doctorSearch]);

  // Collapsed state for slot cards (all open by default)
  const [collapsedSlots, setCollapsedSlots] = useState<Record<string, boolean>>({});

  const toggleSlotCollapse = (slotKey: string) => {
    setCollapsedSlots((prev) => ({
      ...prev,
      [slotKey]: !prev[slotKey],
    }));
  };

  // Walk-in modal state
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInDoctorId, setWalkInDoctorId] = useState(currentDoctor?.id || '');
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

  // Fetch Queue for Doctor & Date
  const fetchQueue = useCallback(
    async (targetDate = currentDate, targetDoctorId = currentDoctor?.id, silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (targetDate) params.set('date', targetDate);
        if (targetDoctorId) params.set('doctorId', targetDoctorId);
        const query = params.toString() ? `?${params.toString()}` : '';

        const res = await clientAxios.get(`/api/receptionist/queue${query}`);
        const data = res.data?.data || [];
        setAppointments(Array.isArray(data) ? data : []);
        if (res.data?.doctor) {
          setCurrentDoctor(res.data.doctor);
        }
        if (res.data?.yesterdayStats) {
          setYesterdayStats(res.data.yesterdayStats);
        }
        if (!silent) toast.success(`Queue refreshed for ${formatDate(targetDate)}`);
      } catch {
        if (!silent) toast.error('Failed to load queue for date');
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [currentDate, currentDoctor?.id],
  );

  // Real-time WebSocket synchronization
  const { isConnected } = useAppointmentSocket({
    role: 'doctor',
    profileId: currentDoctor?.id,
    onEvent: (event) => {
      if (
        event === 'queue.updated' ||
        event === 'doctor.status.board' ||
        event === 'appointment.updated' ||
        event === 'appointment.created' ||
        event === 'appointment.cancelled'
      ) {
        fetchQueue(currentDate, currentDoctor?.id, true);
      }
    },
  });

  const handleSelectDoctor = (doc: ReceptionistDoctorInfo) => {
    setCurrentDoctor(doc);
    setWalkInDoctorId(doc.id);
    setIsDoctorSelectOpen(false);
    setDoctorSearch('');
    fetchQueue(currentDate, doc.id);
    router.replace(`/receptionist/queue?date=${currentDate}&doctorId=${doc.id}`, { scroll: false });
  };

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    setCurrentDate(newDate);
    fetchQueue(newDate, currentDoctor?.id);
    const doctorParam = currentDoctor?.id ? `&doctorId=${currentDoctor.id}` : '';
    router.replace(`/receptionist/queue?date=${newDate}${doctorParam}`, { scroll: false });
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
      await fetchQueue(currentDate, currentDoctor?.id, true);
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
      await fetchQueue(currentDate, currentDoctor?.id, true);
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
      await fetchQueue(currentDate, currentDoctor?.id, true);
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
        doctorId: walkInDoctorId || currentDoctor?.id,
      });
      toast.success('Walk-in patient added to live queue!');
      setIsWalkInOpen(false);
      setWalkInName('');
      setWalkInPhone('');
      setWalkInAge('');
      setWalkInReason('');
      await fetchQueue(currentDate, currentDoctor?.id, true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || 'Failed to book walk-in patient');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Real KPIs
  const totalAppointments = appointments.length;
  const completedCount = useMemo(
    () => appointments.filter((a) => a.status === 'COMPLETED').length,
    [appointments],
  );
  const waitingCount = useMemo(
    () => appointments.filter((a) => a.status === 'CHECKED_IN').length,
    [appointments],
  );
  const upcomingCount = useMemo(
    () => appointments.filter((a) => a.status === 'CONFIRMED').length,
    [appointments],
  );

  // Total appointments trend text
  const totalTrend = useMemo(() => {
    if (yesterdayStats && yesterdayStats.total > 0) {
      const diff = totalAppointments - yesterdayStats.total;
      const pct = Math.round((diff / yesterdayStats.total) * 100);
      if (pct >= 0) {
        return { text: `↑ +${pct}% vs yesterday`, isPositive: true };
      }
      return { text: `↓ ${pct}% vs yesterday`, isPositive: false };
    }
    if (totalAppointments > 0) {
      return { text: `↑ +${totalAppointments} booked today`, isPositive: true };
    }
    return { text: '0 appointments today', isPositive: false };
  }, [totalAppointments, yesterdayStats]);

  // Completed trend text
  const completedTrend = useMemo(() => {
    if (yesterdayStats && yesterdayStats.completed > 0) {
      const diff = completedCount - yesterdayStats.completed;
      const pct = Math.round((diff / yesterdayStats.completed) * 100);
      if (pct >= 0) {
        return { text: `↑ +${pct}% vs yesterday`, isPositive: true };
      }
      return { text: `↓ ${pct}% vs yesterday`, isPositive: false };
    }
    if (completedCount > 0) {
      const rate = Math.round((completedCount / (totalAppointments || 1)) * 100);
      return { text: `↑ ${rate}% completed today`, isPositive: true };
    }
    return { text: '0 completed so far', isPositive: false };
  }, [completedCount, yesterdayStats, totalAppointments]);

  // Group appointments by time slot windows (e.g. 9:00 AM – 10:00 AM, 1:00 PM – 2:00 PM)
  const slotGroups = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};

    // Sort appointments chronologically
    const sorted = [...appointments].sort((a, b) => {
      const timeA = a.startTime || '00:00';
      const timeB = b.startTime || '00:00';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999);
    });

    sorted.forEach((appt) => {
      const slot = formatSlotHourRange(appt.startTime);
      if (!groups[slot]) {
        groups[slot] = [];
      }
      groups[slot].push(appt);
    });

    return groups;
  }, [appointments]);

  const slotKeys = Object.keys(slotGroups);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-3 sm:p-5 lg:p-7 space-y-6">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*               TOP ROW: 4 KPI CARDS WITH SPARKLINES                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Appointments */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Appointments</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {totalAppointments}
              </h3>
              <p
                className={cn(
                  'text-[11px] font-semibold flex items-center gap-0.5 mt-0.5',
                  totalTrend.isPositive ? 'text-emerald-600' : 'text-slate-500',
                )}
              >
                {totalTrend.text}
              </p>
            </div>
          </div>
          <div className="shrink-0 pl-2">
            <svg className="w-20 sm:w-24 h-9 overflow-visible" viewBox="0 0 100 35" fill="none">
              <path
                d="M 0,25 C 22,25 36,32 52,18 C 68,4 82,14 100,6"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Completed</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {completedCount}
              </h3>
              <p
                className={cn(
                  'text-[11px] font-semibold flex items-center gap-0.5 mt-0.5',
                  completedTrend.isPositive ? 'text-emerald-600' : 'text-slate-500',
                )}
              >
                {completedTrend.text}
              </p>
            </div>
          </div>
          <div className="shrink-0 pl-2">
            <svg className="w-20 sm:w-24 h-9 overflow-visible" viewBox="0 0 100 35" fill="none">
              <path
                d="M 0,26 C 25,26 42,24 62,14 C 76,6 88,10 100,4"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Waiting */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Waiting</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {waitingCount}
              </h3>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">In Queue</p>
            </div>
          </div>
        </div>

        {/* Card 4: Upcoming */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex items-center justify-between hover:shadow-sm transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Upcoming</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                {upcomingCount}
              </h3>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">Today</p>
            </div>
          </div>
          <div className="shrink-0 pl-2">
            <svg className="w-20 sm:w-24 h-9 overflow-visible" viewBox="0 0 100 35" fill="none">
              <path
                d="M 0,26 C 25,28 45,22 65,16 C 80,10 90,14 100,8"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*                     MAIN SECTION: 2 COLUMNS                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ─── LEFT PANEL (Step 1 & Step 2) ─── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-5">
            {/* Step 1: Select Doctor */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <h3 className="font-bold text-slate-800 text-sm">Select Doctor</h3>
              </div>

              {/* Single Doctor Search Input with Dropdown */}
              <div className="relative mb-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search doctor..."
                    value={doctorSearch}
                    onChange={(e) => {
                      setDoctorSearch(e.target.value);
                      setIsDoctorSelectOpen(true);
                    }}
                    onFocus={() => setIsDoctorSelectOpen(true)}
                    className="pl-9 pr-9 h-10 rounded-xl bg-white border-slate-200 text-xs focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 shadow-2xs transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setIsDoctorSelectOpen((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform duration-200',
                        isDoctorSelectOpen && 'rotate-180 text-blue-600',
                      )}
                    />
                  </button>
                </div>

                {/* Floating Doctor Search Results */}
                <AnimatePresence>
                  {isDoctorSelectOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsDoctorSelectOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute left-0 right-0 top-11 z-40 bg-white border border-slate-200 shadow-xl rounded-2xl p-2 space-y-1 max-h-[260px] overflow-y-auto"
                      >
                        {filteredDoctors.map((doc) => {
                          const isSelected = currentDoctor?.id === doc.id;
                          const initial = doc.fullName
                            ? doc.fullName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase() || 'D'
                            : 'D';

                          return (
                            <motion.div
                              key={doc.id}
                              whileHover={{ scale: 1.01, x: 2 }}
                              whileTap={{ scale: 0.99 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              onClick={() => handleSelectDoctor(doc)}
                              className={cn(
                                'rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-all',
                                isSelected
                                  ? 'border-2 border-blue-500 bg-blue-50/50 shadow-xs'
                                  : 'border border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/20 bg-white',
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                                    {initial}
                                  </div>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 border border-white absolute bottom-0 right-0" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 text-xs truncate">
                                    {doc.fullName}
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {doc.specialization}
                                  </p>
                                </div>
                              </div>

                              {isSelected && (
                                <div className="w-4.5 h-4.5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                </div>
                              )}
                            </motion.div>
                          );
                        })}

                        {filteredDoctors.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">No matching doctors found</p>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Selected Single Doctor Card with Smooth Box Spring Animation */}
              {currentDoctor && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.97, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -4 }}
                  whileHover={{ scale: 1.015, y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onClick={() => setIsDoctorSelectOpen((prev) => !prev)}
                  className="rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all border-2 border-blue-500 bg-blue-50/20 shadow-xs hover:shadow-md hover:bg-blue-50/30 group select-none"
                  title="Click to search or switch doctor"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar Box with Smooth Hover Animation */}
                    <motion.div
                      whileHover={{ scale: 1.08, rotate: 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="relative shrink-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {currentDoctor.fullName
                          ? currentDoctor.fullName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase() || 'D'
                          : 'D'}
                      </div>
                      {/* Online dot with pulsing halo */}
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0 shadow-xs" />
                    </motion.div>

                    {/* Name & Specialization */}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-700 transition-colors">
                        {currentDoctor.fullName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {currentDoctor.specialization}
                      </p>
                    </div>
                  </div>

                  {/* Selected checkmark badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </motion.div>
                </motion.div>
              )}
            </div>

            {/* Step 2: Select Date (1-Click Direct Calendar Open) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="font-bold text-slate-800 text-sm">Select Date</h3>
              </div>

              <SmoothDatePicker
                value={currentDate}
                onChange={(d) => handleDateChange(d)}
                formatDisplay={(d) => formatDate(d)}
                customTrigger={({ displayText, isOpen }) => (
                  <button
                    type="button"
                    className={cn(
                      'w-full border rounded-xl p-3 flex items-center justify-between bg-white transition-all cursor-pointer text-left shadow-2xs',
                      isOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-sm text-slate-800">
                        {displayText}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180 text-blue-600',
                      )}
                    />
                  </button>
                )}
              />
            </div>
          </div>

          {/* Bottom Helper Banner */}
          <div className="bg-gradient-to-br from-[#eef5fc] via-[#edf3fa] to-[#e4eef9] border border-[#d3e3f7] rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-start gap-2.5 relative z-10 max-w-[80%]">
              <div className="w-6 h-6 rounded-full bg-white border border-emerald-300 text-emerald-500 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                You can now view live queue and appointments for selected doctor and date.
              </p>
            </div>

            {/* Decorative Calendar & Clock Graphic */}
            <div className="absolute right-2 -bottom-2 pointer-events-none opacity-85 select-none">
              <svg width="84" height="84" viewBox="0 0 100 100" fill="none">
                {/* Calendar Body */}
                <rect x="20" y="24" width="55" height="50" rx="10" fill="#3b82f6" fillOpacity="0.15" />
                <rect x="22" y="26" width="51" height="46" rx="8" fill="#ffffff" />
                {/* Calendar Header */}
                <path d="M22 34 C22 30 25 26 29 26 L66 26 C70 26 73 30 73 34 L73 38 L22 38 Z" fill="#3b82f6" />
                {/* Tabs */}
                <rect x="32" y="21" width="4" height="8" rx="2" fill="#2563eb" />
                <rect x="58" y="21" width="4" height="8" rx="2" fill="#2563eb" />
                {/* Grid dots */}
                <circle cx="34" cy="46" r="2.5" fill="#93c5fd" />
                <circle cx="48" cy="46" r="2.5" fill="#93c5fd" />
                <circle cx="62" cy="46" r="2.5" fill="#93c5fd" />
                <circle cx="34" cy="56" r="2.5" fill="#93c5fd" />
                <circle cx="48" cy="56" r="2.5" fill="#2563eb" />
                <circle cx="62" cy="56" r="2.5" fill="#93c5fd" />
                {/* Clock at corner */}
                <circle cx="68" cy="68" r="16" fill="#ffffff" stroke="#3b82f6" strokeWidth="3" />
                <circle cx="68" cy="68" r="14" fill="#60a5fa" fillOpacity="0.2" />
                <path d="M68 59 L68 68 L74 72" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL (Doctor Queue & Slots) ─── */}
        <div className="lg:col-span-8 space-y-4">
          {/* Doctor Header Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            {/* Left: Animated Avatar + Name + Available Badge + Specialization */}
            <div className="flex items-center gap-3.5">
              <motion.div
                whileHover={{ scale: 1.08, rotate: 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center shrink-0 cursor-pointer shadow-2xs hover:bg-blue-600 hover:text-white transition-colors"
              >
                {currentDoctor?.fullName
                  ? currentDoctor.fullName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase() || 'D'
                  : 'D'}
              </motion.div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900">
                    {currentDoctor?.fullName || 'Dr. Rahul'}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentDoctor?.specialization || 'General Physician'}
                </p>
              </div>
            </div>

            {/* Right: Date Pill (1-Click Direct Calendar Open) & Walk-in Action */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <SmoothDatePicker
                value={currentDate}
                onChange={(d) => handleDateChange(d)}
                formatDisplay={(d) => formatDayAndDate(d)}
                customTrigger={({ displayText, isOpen }) => (
                  <button
                    type="button"
                    className={cn(
                      'border rounded-xl px-3.5 py-2 flex items-center gap-2 cursor-pointer bg-white shadow-2xs text-xs font-semibold text-slate-700 transition-all',
                      isOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                        : 'border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <CalendarDays className="w-4 h-4 text-slate-500" />
                    <span>{displayText}</span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                        isOpen && 'rotate-180 text-blue-600',
                      )}
                    />
                  </button>
                )}
              />

              <Button
                onClick={() => {
                  setWalkInDoctorId(currentDoctor?.id || '');
                  setIsWalkInOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 h-auto rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                + Walk-in Patient
              </Button>

              <button
                onClick={() => fetchQueue(currentDate, currentDoctor?.id)}
                disabled={refreshing}
                title="Refresh Queue"
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin text-blue-600')} />
              </button>
            </div>
          </div>

          {/* ─── SLOT CARDS LIST ─── */}
          {slotKeys.length > 0 ? (
            slotKeys.map((slotKey) => {
              const slotAppts = slotGroups[slotKey] || [];
              const isCollapsed = !!collapsedSlots[slotKey];
              const activeSlot = isSlotActiveNow(slotKey, currentDate, todayIST);

              return (
                <div
                  key={slotKey}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all"
                >
                  {/* Slot Top Header Bar */}
                  <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>{slotKey}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleSlotCollapse(slotKey)}
                      className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isCollapsed ? 'View Details' : 'Hide Details'}
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 text-slate-500 transition-transform duration-200',
                          !isCollapsed && 'rotate-180',
                        )}
                      />
                    </button>
                  </div>

                  {!isCollapsed && (
                    <>
                      {/* Slot Subheader Ribbon */}
                      <div className="px-5 py-2.5 bg-[#f0f5fc] flex items-center justify-between border-b border-blue-100/60 text-xs">
                        <span className="font-semibold text-slate-700">
                          Live Queue for {slotKey}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              activeSlot ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400',
                            )}
                          />
                          <span
                            className={cn(
                              'font-semibold text-xs',
                              activeSlot ? 'text-emerald-600' : 'text-slate-500',
                            )}
                          >
                            {activeSlot ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      {/* Queue Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                              <th className="px-5 py-3 w-12 text-center">#</th>
                              <th className="px-4 py-3">Patient Name</th>
                              <th className="px-4 py-3">Token No.</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Waiting Time</th>
                              <th className="px-5 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {slotAppts.map((appt, idx) => {
                              const tokenStr = appt.tokenNumber
                                ? `T-${String(appt.tokenNumber).padStart(3, '0')}`
                                : `T-${String(idx + 1).padStart(3, '0')}`;
                              const patientName = appt.patient?.fullName || 'Walk-in Patient';
                              const waitingTime = getWaitingTime(appt);

                              const isServing = appt.status === 'IN_CONSULTATION';
                              const isWaiting = appt.status === 'CHECKED_IN' || appt.status === 'CONFIRMED';
                              const isCompleted = appt.status === 'COMPLETED';
                              const isNoShow = appt.status === 'NO_SHOW';

                              return (
                                <tr
                                  key={appt.id}
                                  className="hover:bg-slate-50/60 transition-colors"
                                >
                                  {/* # */}
                                  <td className="px-5 py-3.5 text-center font-bold text-slate-700">
                                    {idx + 1}
                                  </td>

                                  {/* Patient Name */}
                                  <td className="px-4 py-3.5 font-semibold text-slate-900">
                                    <div className="flex items-center gap-2">
                                      <span>{patientName}</span>
                                      {appt.isWalkIn && (
                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-normal px-1.5 py-0.5 rounded">
                                          Walk-in
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Token No. */}
                                  <td className="px-4 py-3.5 font-semibold text-slate-700">
                                    {tokenStr}
                                  </td>

                                  {/* Status */}
                                  <td className="px-4 py-3.5">
                                    {isServing && (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Currently Serving
                                      </span>
                                    )}
                                    {isWaiting && (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                        Waiting
                                      </span>
                                    )}
                                    {isCompleted && (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                        Completed
                                      </span>
                                    )}
                                    {isNoShow && (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                        No Show
                                      </span>
                                    )}
                                    {!isServing && !isWaiting && !isCompleted && !isNoShow && (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                        {appt.status}
                                      </span>
                                    )}
                                  </td>

                                  {/* Waiting Time */}
                                  <td className="px-4 py-3.5 font-medium text-slate-600">
                                    {waitingTime}
                                  </td>

                                  {/* Action Menu */}
                                  <td className="px-5 py-3.5 text-right">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
                                          <MoreVertical className="w-4 h-4" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        align="end"
                                        className="w-48 p-1.5 text-xs shadow-lg border border-slate-200 rounded-xl space-y-0.5 bg-white"
                                      >
                                        {appt.status === 'CONFIRMED' && (
                                          <button
                                            onClick={() => handleAction(appt.id, 'manual-check-in')}
                                            disabled={loadingId === `${appt.id}-manual-check-in`}
                                            className="w-full text-left px-3 py-2 rounded-lg font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                            Check-in Patient
                                          </button>
                                        )}

                                        {appt.status === 'CHECKED_IN' && (
                                          <button
                                            onClick={() => handleAction(appt.id, 'start-consultation')}
                                            disabled={loadingId === `${appt.id}-start-consultation`}
                                            className="w-full text-left px-3 py-2 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                          >
                                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                            Call Cabin (Consult)
                                          </button>
                                        )}

                                        {appt.status === 'IN_CONSULTATION' && (
                                          <button
                                            onClick={() => handleAction(appt.id, 'complete')}
                                            disabled={loadingId === `${appt.id}-complete`}
                                            className="w-full text-left px-3 py-2 rounded-lg font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            Mark as Complete
                                          </button>
                                        )}

                                        {['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(appt.status) && (
                                          <button
                                            onClick={() => handleAction(appt.id, 'no-show')}
                                            disabled={loadingId === `${appt.id}-no-show`}
                                            className="w-full text-left px-3 py-2 rounded-lg font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition-colors"
                                          >
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                            Mark No Show
                                          </button>
                                        )}

                                        {['CONFIRMED', 'CHECKED_IN'].includes(appt.status) && (
                                          <button
                                            onClick={() => {
                                              setRescheduleTarget(appt);
                                              setRescheduleDate(appt.date || currentDate);
                                              setRescheduleStartTime(appt.startTime || '10:00');
                                              setRescheduleEndTime(appt.endTime || '10:15');
                                            }}
                                            className="w-full text-left px-3 py-2 rounded-lg font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                          >
                                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                            Reschedule
                                          </button>
                                        )}

                                        {['CONFIRMED', 'CHECKED_IN'].includes(appt.status) && (
                                          <button
                                            onClick={() => setCancelTarget(appt)}
                                            className="w-full text-left px-3 py-2 rounded-lg font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                          >
                                            <X className="w-3.5 h-3.5 text-rose-600" />
                                            Cancel Appointment
                                          </button>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          ) : (
            /* Empty Queue State */
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">No Patients in Queue</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                There are no patient appointments scheduled for this doctor on{' '}
                {formatDate(currentDate)}. You can add a walk-in patient anytime.
              </p>
              <Button
                onClick={() => {
                  setWalkInDoctorId(currentDoctor?.id || '');
                  setIsWalkInOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 h-auto rounded-xl shadow-xs inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Walk-in Patient
              </Button>
            </div>
          )}
        </div>
      </div>
      <Dialog open={isWalkInOpen} onOpenChange={setIsWalkInOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Add Walk-in Patient
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Register a walk-in patient directly into today’s live queue.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWalkIn} className="space-y-4 pt-2">
            {/* Target Doctor selector */}
            {doctorList.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Assign Doctor</label>
                <select
                  value={walkInDoctorId}
                  onChange={(e) => setWalkInDoctorId(e.target.value)}
                  className="w-full text-xs h-9 rounded-xl border border-slate-200 bg-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {doctorList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.fullName} ({doc.specialization})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Patient Full Name *</label>
              <Input
                required
                placeholder="e.g. Rahul Sharma"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="text-xs h-9 rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Phone Number *</label>
              <Input
                required
                placeholder="e.g. 9876543210"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                className="text-xs h-9 rounded-xl border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Age</label>
                <Input
                  type="number"
                  placeholder="e.g. 32"
                  value={walkInAge}
                  onChange={(e) => setWalkInAge(e.target.value)}
                  className="text-xs h-9 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Gender</label>
                <select
                  value={walkInGender}
                  onChange={(e) => setWalkInGender(e.target.value)}
                  className="w-full text-xs h-9 rounded-xl border border-slate-200 bg-white px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Reason / Symptoms</label>
              <Input
                placeholder="e.g. Fever, routine checkup"
                value={walkInReason}
                onChange={(e) => setWalkInReason(e.target.value)}
                className="text-xs h-9 rounded-xl border-slate-200"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWalkInOpen(false)}
                className="text-xs h-9 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={walkInSubmitting}
                className="text-xs h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {walkInSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Adding...
                  </>
                ) : (
                  'Add to Queue'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*                     RESCHEDULE MODAL DIALOG                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Reschedule Appointment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select a new date and time slot for{' '}
              <strong className="text-slate-800">{rescheduleTarget?.patient?.fullName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReschedule} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">New Date</label>
              <Input
                type="date"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="text-xs h-9 rounded-xl border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Start Time</label>
                <Input
                  type="time"
                  required
                  value={rescheduleStartTime}
                  onChange={(e) => setRescheduleStartTime(e.target.value)}
                  className="text-xs h-9 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">End Time</label>
                <Input
                  type="time"
                  required
                  value={rescheduleEndTime}
                  onChange={(e) => setRescheduleEndTime(e.target.value)}
                  className="text-xs h-9 rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Reason for Rescheduling</label>
              <Input
                placeholder="e.g. Patient requested morning slot"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                className="text-xs h-9 rounded-xl border-slate-200"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleTarget(null)}
                className="text-xs h-9 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={rescheduling}
                className="text-xs h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {rescheduling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Rescheduling...
                  </>
                ) : (
                  'Confirm Reschedule'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/*                      CANCEL MODAL DIALOG                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to cancel the appointment for{' '}
              <strong className="text-slate-800">{cancelTarget?.patient?.fullName}</strong>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
              className="text-xs h-9 rounded-xl"
            >
              No, Keep It
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Appointment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
