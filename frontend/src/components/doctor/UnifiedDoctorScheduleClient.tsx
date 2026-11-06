'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RecurringAvailability,
  DoctorLeave,
  CustomAvailabilityOverride,
  DayScheduleDetail,
} from '@/types';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { formatTime, formatDate, getTodayIST } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Sliders,
  CheckCircle2,
  CalendarX2,
  AlertTriangle,
  Sparkles,
  Zap,
  ShieldAlert,
  Layers,
  ArrowRight,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Users,
  BarChart3,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UnifiedDoctorScheduleClientProps {
  initialAvailability: any;
  initialLeaves: DoctorLeave[];
  defaultTab?: 'recurring' | 'occupancy' | 'overrides' | 'unavailable' | 'leaves';
}

function parseAvailabilityList(input: unknown): RecurringAvailability[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const obj = input as any;
    if (Array.isArray(obj.recurring)) return obj.recurring;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

function parseCustomOverridesList(input: unknown): CustomAvailabilityOverride[] {
  if (input && typeof input === 'object') {
    const obj = input as any;
    if (Array.isArray(obj.customOverrides)) return obj.customOverrides;
    if (obj.data && Array.isArray(obj.data.customOverrides)) return obj.data.customOverrides;
  }
  return [];
}

function parseGeneratedSchedule(input: unknown): DayScheduleDetail[] {
  if (input && typeof input === 'object') {
    const obj = input as any;
    if (Array.isArray(obj.generatedSchedule)) return obj.generatedSchedule;
    if (obj.data && Array.isArray(obj.data.generatedSchedule)) return obj.data.generatedSchedule;
  }
  return [];
}

function calculateShiftSubSlots(
  startTime: string,
  endTime: string,
  duration: number,
  buffer: number,
  schedulingType: 'STREAM' | 'WAVE',
  maxPatients: number,
) {
  if (schedulingType === 'STREAM') {
    return [
      {
        startTime,
        endTime,
        maxPatients: maxPatients || 10,
      },
    ];
  }

  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  const subSlots: Array<{ startTime: string; endTime: string; maxPatients: number }> = [];
  let curr = startMins;

  while (curr + duration <= endMins) {
    const sH = Math.floor(curr / 60);
    const sM = curr % 60;
    const eH = Math.floor((curr + duration) / 60);
    const eM = (curr + duration) % 60;

    const sStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    const eStr = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;

    subSlots.push({
      startTime: sStr,
      endTime: eStr,
      maxPatients: maxPatients || 3,
    });

    curr += duration + buffer;
  }

  return subSlots;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

export function UnifiedDoctorScheduleClient({
  initialAvailability,
  initialLeaves,
  defaultTab = 'recurring',
}: UnifiedDoctorScheduleClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'recurring' | 'occupancy' | 'overrides' | 'unavailable' | 'leaves'>(defaultTab);

  // Availability State
  const [availabilities, setAvailabilities] = useState<RecurringAvailability[]>(() =>
    parseAvailabilityList(initialAvailability),
  );
  const [leaves, setLeaves] = useState<DoctorLeave[]>(() =>
    Array.isArray(initialLeaves) ? initialLeaves : [],
  );
  const [customOverrides, setCustomOverrides] = useState<CustomAvailabilityOverride[]>(() =>
    parseCustomOverridesList(initialAvailability),
  );
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);

  // Live Generated Schedule & Occupancy State
  const [generatedSchedule, setGeneratedSchedule] = useState<DayScheduleDetail[]>(() =>
    parseGeneratedSchedule(initialAvailability),
  );
  const [selectedOccupancyDate, setSelectedOccupancyDate] = useState<string>(getTodayIST());
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});
  const [refreshingSchedule, setRefreshingSchedule] = useState(false);

  const toggleExpandShift = (id: string) => {
    setExpandedShiftIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const refreshFullSchedule = async () => {
    try {
      setRefreshingSchedule(true);
      const res = await clientAxios.get<any>('/api/doctor/availability-proxy');
      const payload = res.data?.data || res.data;
      setAvailabilities(parseAvailabilityList(payload));
      setCustomOverrides(parseCustomOverridesList(payload));
      setGeneratedSchedule(parseGeneratedSchedule(payload));
      toast.success('Roster Refreshed', { description: 'Live slot occupancy updated with latest bookings.' });
    } catch (err: unknown) {
      toast.error('Could not refresh roster', { description: extractErrorMessage(err) });
    } finally {
      setRefreshingSchedule(false);
    }
  };

  // Recurring Form State
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
  ]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState<number>(30);
  const [schedulingType, setSchedulingType] = useState<'STREAM' | 'WAVE'>('WAVE');
  const [bufferTime, setBufferTime] = useState<number>(0);
  const [maxPatients, setMaxPatients] = useState<number>(3);
  const [allowFutureBooking, setAllowFutureBooking] = useState(true);
  const [maxFutureBookingDays, setMaxFutureBookingDays] = useState(7);
  const [savingRecurring, setSavingRecurring] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Date Override State
  const [overrideDate, setOverrideDate] = useState(getTodayIST());
  const [overrideStartTime, setOverrideStartTime] = useState('10:00');
  const [overrideEndTime, setOverrideEndTime] = useState('14:00');
  const [overrideDuration, setOverrideDuration] = useState(30);
  const [overrideBuffer, setOverrideBuffer] = useState(0);
  const [overrideSchedulingType, setOverrideSchedulingType] = useState<'STREAM' | 'WAVE'>('WAVE');
  const [overrideMaxPatients, setOverrideMaxPatients] = useState<number>(3);
  const [savingOverride, setSavingOverride] = useState(false);

  // Unavailable State
  const [unavailDate, setUnavailDate] = useState(getTodayIST());
  const [unavailStartTime, setUnavailStartTime] = useState('');
  const [unavailEndTime, setUnavailEndTime] = useState('');
  const [isFullDayUnavail, setIsFullDayUnavail] = useState(true);
  const [savingUnavail, setSavingUnavail] = useState(false);

  // Leave Form State
  const [leaveDate, setLeaveDate] = useState(getTodayIST());
  const [leaveReason, setLeaveReason] = useState('');
  const [savingLeave, setSavingLeave] = useState(false);
  const [deletingLeaveId, setDeletingLeaveId] = useState<string | null>(null);

  // Toggle Day Selection
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length === 1) {
        toast.warning('Select at least one day');
        return;
      }
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const selectPresetDays = (preset: 'weekdays' | 'weekend' | 'all') => {
    if (preset === 'weekdays') {
      setSelectedDays(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
    } else if (preset === 'weekend') {
      setSelectedDays(['SATURDAY', 'SUNDAY']);
    } else {
      setSelectedDays([...DAYS_OF_WEEK]);
    }
  };

  // Calculate Slot Count Preview
  const calculatePreviewSlots = () => {
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      if (endMin <= startMin) return 0;

      const totalWorkingMins = endMin - startMin;
      if (schedulingType === 'STREAM') {
        return maxPatients || 10;
      }
      const slotAndBuffer = slotDuration + bufferTime;
      if (slotAndBuffer <= 0) return 0;

      return Math.floor(totalWorkingMins / slotAndBuffer) * (maxPatients || 3);
    } catch {
      return 0;
    }
  };

  const previewSlotCount = calculatePreviewSlots();

  // 1. Submit Recurring Availability
  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();

    if (endTime <= startTime) {
      toast.error('Invalid Time Range', {
        description: 'End time must be later than start time',
      });
      return;
    }

    try {
      setSavingRecurring(true);

      const payload = {
        daysOfWeek: selectedDays,
        startTime,
        endTime,
        schedulingType,
        slotDuration: Number(slotDuration),
        bufferTime: Number(bufferTime),
        maxPatients: Number(maxPatients),
        allowFutureBooking,
        maxFutureBookingDays: allowFutureBooking ? Number(maxFutureBookingDays) : null,
      };

      await clientAxios.post('/api/doctor/availability-proxy', payload);

      toast.success('Shift Schedule Saved', {
        description: `Applied ${selectedDays.length} day(s) from ${formatTime(startTime)} to ${formatTime(endTime)}`,
      });

      // Refetch
      const updatedRes = await clientAxios.get<any>('/api/doctor/availability-proxy');
      const updatedData = updatedRes.data?.data || updatedRes.data;
      setAvailabilities(parseAvailabilityList(updatedData));
      setCustomOverrides(parseCustomOverridesList(updatedData));
      setGeneratedSchedule(parseGeneratedSchedule(updatedData));
      router.refresh();
    } catch (err: unknown) {
      toast.error('Failed to configure availability', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSavingRecurring(false);
    }
  };

  // Delete Recurring Slot
  const handleDeleteSlot = async (id: string) => {
    if (!confirm('Are you sure you want to remove this recurring shift?')) return;

    try {
      setDeletingId(id);
      await clientAxios.delete(`/api/doctor/availability-proxy/${id}`);

      toast.success('Shift Deleted');
      setAvailabilities((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch (err: unknown) {
      toast.error('Delete failed', { description: extractErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  // 2. Submit Custom Override
  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overrideEndTime <= overrideStartTime) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      setSavingOverride(true);
      await clientAxios.post('/api/doctor/availability-proxy/override', {
        date: overrideDate,
        startTime: overrideStartTime,
        endTime: overrideEndTime,
        slotDuration: Number(overrideDuration),
        bufferTime: Number(overrideBuffer),
        schedulingType: overrideSchedulingType,
        maxPatients: Number(overrideMaxPatients),
      });

      toast.success('Custom Shift Added!', {
        description: `Special consultation slots opened on ${formatDate(overrideDate)}.`,
      });

      try {
        const updatedRes = await clientAxios.get<any>('/api/doctor/availability-proxy');
        const payload = updatedRes.data?.data || updatedRes.data;
        setAvailabilities(parseAvailabilityList(payload));
        setCustomOverrides(parseCustomOverridesList(payload));
        setGeneratedSchedule(parseGeneratedSchedule(payload));
      } catch (e) {
        // Fallback
      }

      router.refresh();
    } catch (err: unknown) {
      toast.error('Override Failed', { description: extractErrorMessage(err) });
    } finally {
      setSavingOverride(false);
    }
  };

  // Delete Custom Override
  const handleDeleteOverride = async (id: string, date: string, startTime: string, endTime: string) => {
    if (!confirm(`Are you sure you want to remove the special shift on ${formatDate(date)} (${formatTime(startTime)} – ${formatTime(endTime)})?`)) {
      return;
    }

    try {
      setDeletingOverrideId(id);
      await clientAxios.delete(`/api/doctor/availability-proxy/override/${id}`);

      toast.success('Shift Override Removed', {
        description: `Special schedule for ${formatDate(date)} has been removed.`,
      });
      setCustomOverrides((prev) => prev.filter((o) => o.id !== id));
      router.refresh();
    } catch (err: unknown) {
      toast.error('Failed to remove override', {
        description: extractErrorMessage(err),
      });
    } finally {
      setDeletingOverrideId(null);
    }
  };

  // 3. Submit Mark Unavailable
  const handleSetUnavailable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingUnavail(true);
      const payload: any = { date: unavailDate };
      if (!isFullDayUnavail) {
        if (!unavailStartTime || !unavailEndTime || unavailEndTime <= unavailStartTime) {
          toast.error('Please specify valid start and end hours');
          setSavingUnavail(false);
          return;
        }
        payload.startTime = unavailStartTime;
        payload.endTime = unavailEndTime;
      }

      await clientAxios.post('/api/doctor/availability-proxy/unavailable', payload);

      toast.success('Marked Unavailable', {
        description: isFullDayUnavail
          ? `Full day on ${formatDate(unavailDate)} blocked.`
          : `Hours ${unavailStartTime} - ${unavailEndTime} on ${formatDate(unavailDate)} blocked. Booked visits rescheduled.`,
      });
      router.refresh();
    } catch (err: unknown) {
      toast.error('Action Failed', { description: extractErrorMessage(err) });
    } finally {
      setSavingUnavail(false);
    }
  };

  // 4. Submit Apply Leave
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingLeave(true);
      await clientAxios.post('/api/doctor/leave-proxy', {
        date: leaveDate,
        reason: leaveReason || undefined,
      });

      toast.success('Clinical Leave Scheduled', {
        description: `Marked unavailable on ${formatDate(leaveDate)}. Affected patients notified.`,
      });

      setLeaveReason('');
      const updatedRes = await clientAxios.get<{ data: DoctorLeave[] }>('/api/doctor/leave-proxy');
      const rawData = updatedRes.data?.data ?? updatedRes.data;
      if (Array.isArray(rawData)) {
        setLeaves(rawData);
      }
      router.refresh();
    } catch (err: unknown) {
      toast.error('Leave Request Failed', { description: extractErrorMessage(err) });
    } finally {
      setSavingLeave(false);
    }
  };

  // Delete Leave
  const handleDeleteLeave = async (id: string) => {
    try {
      setDeletingLeaveId(id);
      await clientAxios.delete(`/api/doctor/leave-proxy/${id}`);

      toast.success('Leave Cancelled — Slots reopened for booking');
      setLeaves((prev) => (Array.isArray(prev) ? prev.filter((l) => l.id !== id) : []));
      router.refresh();
    } catch (err: unknown) {
      toast.error('Error deleting leave', { description: extractErrorMessage(err) });
    } finally {
      setDeletingLeaveId(null);
    }
  };

  // Summary Metrics
  const uniqueConfiguredDays = new Set(availabilities.map((a) => a.dayOfWeek)).size;

  return (
    <div className="space-y-8">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Weekly Active Days</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700 border border-blue-100">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {uniqueConfiguredDays} <span className="text-xs font-normal text-slate-400">/ 7 days</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Configured Shifts</span>
            <div className="rounded-xl bg-sky-50 p-2 text-sky-700 border border-sky-100">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {availabilities.length} <span className="text-xs font-normal text-slate-400">shifts</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Scheduled Leaves</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 border border-amber-100">
              <CalendarX2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {leaves.length} <span className="text-xs font-normal text-slate-400">blocked</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400">Future Window</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 border border-emerald-100">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 font-mono">
            {allowFutureBooking ? `${maxFutureBookingDays}d` : '1d (Same day)'}
          </p>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-2xs scrollbar-none">
        <Button type="button" variant="ghost" onClick={() => setActiveTab('recurring')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'recurring'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          } h-auto`}>
          <Clock className="h-3.5 w-3.5" />
          <span>Weekly Recurring Shifts</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${
            activeTab === 'recurring' ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {availabilities.length}
          </span>
        </Button>

        <Button type="button" variant="ghost" onClick={() => setActiveTab('occupancy')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'occupancy'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          } h-auto`}>
          <Layers className="h-3.5 w-3.5" />
          <span>Live Slots & Occupancy</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${
            activeTab === 'occupancy' ? 'bg-blue-800 text-blue-100' : 'bg-emerald-50 text-emerald-700 font-semibold'
          }`}>
            Live Roster
          </span>
        </Button>

        <Button type="button" variant="ghost" onClick={() => setActiveTab('leaves')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'leaves'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          } h-auto`}>
          <CalendarX2 className="h-3.5 w-3.5" />
          <span>Planned Leaves & Time Off</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${
            activeTab === 'leaves' ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {leaves.length}
          </span>
        </Button>

        <Button type="button" variant="ghost" onClick={() => setActiveTab('overrides')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overrides'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          } h-auto`}>
          <Zap className="h-3.5 w-3.5" />
          <span>Special Date Override</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${
            activeTab === 'overrides' ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'
          }`}>
            {customOverrides.length}
          </span>
        </Button>

        <Button type="button" variant="ghost" onClick={() => setActiveTab('unavailable')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'unavailable'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          } h-auto`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Block Specific Hours</span>
        </Button>
      </div>

      {/* ─── TAB 1: RECURRING AVAILABILITY ─── */}
      {activeTab === 'recurring' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Shift Builder Form */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
                <Sliders className="h-3.5 w-3.5" />
                Shift Architecture
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Configure Clinic Shifts</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set active days, hours, slot length, and buffer time in one unified builder.
              </p>
            </div>

            <form onSubmit={handleCreateRecurring} className="space-y-5">
              {/* Day Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Active Days of Week
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Button type="button" variant="link" size="xs" onClick={() => selectPresetDays('weekdays')} className="text-blue-700 font-bold hover:underline p-0 h-auto">Mon-Fri</Button>
                    <span className="text-slate-300">•</span>
                    <Button type="button" variant="link" size="xs" onClick={() => selectPresetDays('all')} className="text-blue-700 font-bold hover:underline p-0 h-auto">All 7</Button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <Button key={day} type="button" variant="ghost" onClick={() => toggleDay(day)} className={`py-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                          isSelected
                            ? 'border-blue-700 bg-blue-700 text-white shadow-2xs'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                        } h-auto`}>{DAY_LABELS[day]}</Button>
                    );
                  })}
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shift Start (24h)
                  </label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 h-auto" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shift End (24h)
                  </label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 h-auto" required />
                </div>
              </div>

              {/* Slot Duration & Buffer Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Slot Duration (mins)
                  </label>
                  <Select value={String(slotDuration)} onValueChange={(val) => setSlotDuration(Number(val))}>
                    <SelectTrigger className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 h-auto">
                      <SelectValue placeholder="Slot Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="20">20 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Buffer Time (mins)
                  </label>
                  <Select value={String(bufferTime)} onValueChange={(val) => setBufferTime(Number(val))}>
                    <SelectTrigger className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 h-auto">
                      <SelectValue placeholder="Buffer Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 mins (No buffer)</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Capacity Model: WAVE vs STREAM */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Consultation Scheduling Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setSchedulingType('WAVE'); if (maxPatients === 15) setMaxPatients(3); }} className={`p-3 rounded-2xl border text-left transition-all ${
                      schedulingType === 'WAVE'
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900 ring-1 ring-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    } h-auto flex-col items-start`}>
                    <span className="block text-xs font-bold text-slate-900">WAVE Scheduling</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Time slots with slot capacity</span>
                  </Button>

                  <Button type="button" variant="ghost" onClick={() => { setSchedulingType('STREAM'); if (maxPatients === 3) setMaxPatients(15); }} className={`p-3 rounded-2xl border text-left transition-all ${
                      schedulingType === 'STREAM'
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900 ring-1 ring-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    } h-auto flex-col items-start`}>
                    <span className="block text-xs font-bold text-slate-900">STREAM Scheduling</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Continuous session with queue tokens</span>
                  </Button>
                </div>

                {schedulingType === 'WAVE' ? (
                  <div className="mt-2.5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Capacity per Slot (Max Patients per Slot)
                    </label>
                    <Input type="number" min={1} max={20} value={maxPatients} onChange={(e) => setMaxPatients(Math.max(1, Number(e.target.value)))} className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 h-auto" />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. 3 patients can book each 30-minute slot</span>
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Total Session Capacity (Max Patients for Window)
                    </label>
                    <Input type="number" min={1} max={100} value={maxPatients} onChange={(e) => setMaxPatients(Math.max(1, Number(e.target.value)))} className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 h-auto" />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. 15 patients accommodated with sequential tokens</span>
                  </div>
                )}
              </div>

              {/* Advance Booking Policy */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Allow Advance Booking</span>
                    <span className="text-[11px] text-slate-500">Allow patients to book upcoming calendar dates</span>
                  </div>
                  <Input type="checkbox" checked={allowFutureBooking} onChange={(e) => setAllowFutureBooking(e.target.checked)} className="h-4 w-4 rounded text-blue-700 focus:ring-blue-500 shadow-none border-slate-300 p-0 inline-block" />
                </div>

                {allowFutureBooking && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Max Advance Booking Days ({maxFutureBookingDays} days)
                    </label>
                    <Input type="range" min={1} max={30} value={maxFutureBookingDays} onChange={(e) => setMaxFutureBookingDays(Number(e.target.value))} className="w-full accent-blue-700 p-0 border-0 shadow-none h-auto" />
                  </div>
                )}
              </div>

              {/* Slot Calculator Output */}
              <div className="rounded-2xl bg-blue-50/90 border border-blue-200/80 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-blue-900 block">Calculated Daily Capacity</span>
                  <span className="text-xs text-blue-800">
                    ~{previewSlotCount} {schedulingType === 'WAVE' ? 'spots across slots/day' : 'patients/stream session'}
                  </span>
                </div>
                <span className="font-mono text-xl font-black text-blue-900">
                  {previewSlotCount * selectedDays.length} <span className="text-xs font-normal">spots/wk</span>
                </span>
              </div>

              <Button type="submit" disabled={savingRecurring} className="btn-primary w-full py-3 text-xs h-auto">
                {savingRecurring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Schedule…</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Apply Weekly Schedule</span>
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Active Schedule Overview */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Active Shift Roster</h3>
                <p className="text-xs text-slate-500">Currently active recurring consultation windows</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {availabilities.length} Shifts Configured
              </span>
            </div>

            {customOverrides.length > 0 && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  You have <strong>{customOverrides.length} active date override(s)</strong> set in &ldquo;Special Date Override&rdquo;. Those specific dates will use your custom shifts instead of these weekly recurring hours.
                </span>
              </div>
            )}

            {availabilities.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-xs">
                <Clock className="h-8 w-8 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm mt-3">No shifts configured yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Configure your weekly schedule on the left to allow patients to discover and book appointments.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {availabilities.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-200/60">
                          {slot.dayOfWeek}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {slot.schedulingType || 'STREAM'}
                        </span>
                      </div>

                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-mono text-base font-extrabold text-slate-900">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                        {slot.schedulingType === 'WAVE' ? (
                          <>
                            <span>Slot: {slot.slotDuration || 30}m</span>
                            <span>•</span>
                            <span>Buffer: {slot.bufferTime || 0}m</span>
                            <span>•</span>
                            <span>Capacity: {slot.maxPatients || 3} / slot</span>
                          </>
                        ) : (
                          <>
                            <span>Stream Window</span>
                            <span>•</span>
                            <span>Session Capacity: {slot.maxPatients || 10}</span>
                          </>
                        )}
                      </div>

                      {/* Expandable Generated Slots Preview */}
                      {(() => {
                        const calculatedSubSlots = calculateShiftSubSlots(
                          slot.startTime,
                          slot.endTime,
                          slot.slotDuration || 30,
                          slot.bufferTime || 0,
                          slot.schedulingType || 'STREAM',
                          slot.maxPatients || (slot.schedulingType === 'WAVE' ? 3 : 10),
                        );
                        const isExpanded = Boolean(expandedShiftIds[slot.id]);

                        return (
                          <div className="mt-3 border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandShift(slot.id)}
                              className="w-full flex items-center justify-between text-[11px] font-bold text-blue-700 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50/60 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" />
                                <span>
                                  {slot.schedulingType === 'WAVE'
                                    ? `View Slot Architecture (${calculatedSubSlots.length} slots generated)`
                                    : 'View Stream Session Capacity'}
                                </span>
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 space-y-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/60 max-h-48 overflow-y-auto">
                                {calculatedSubSlots.map((sub, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-slate-200/70 text-[11px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[9px] flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      <span className="font-mono font-bold text-slate-800">
                                        {formatTime(sub.startTime)} – {formatTime(sub.endTime)}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      {slot.schedulingType === 'WAVE'
                                        ? `Max ${sub.maxPatients} patients`
                                        : `Total ${sub.maxPatients} queue capacity`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-2.5">
                      <Button type="button" variant="ghost" size="xs" onClick={() => handleDeleteSlot(slot.id)} disabled={deletingId === slot.id} className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 p-1 rounded-lg hover:bg-rose-50 transition-colors h-auto">
                        {deletingId === slot.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>Remove Shift</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: PLANNED LEAVES ─── */}
      {activeTab === 'leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Add Leave Form */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
                <CalendarX2 className="h-3.5 w-3.5" />
                Clinical Leave Safeguard
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Schedule Doctor Leave</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Block entire calendar days with automatic patient notification and slot protection.
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="block font-semibold mb-0.5">Automated Safeguard System</strong>
                Patients with existing bookings on this date will be automatically notified via SMS/Email and rescheduled.
              </div>
            </div>

            <form onSubmit={handleAddLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Leave Date
                </label>
                <Input type="date" min={getTodayIST()} value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 h-auto" required />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Internal Note (Optional)
                </label>
                <Textarea rows={3} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="e.g. Medical Conference, Annual Leave, CME Seminar" className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-600 resize-none" />
              </div>

              <Button type="submit" disabled={savingLeave} className="btn-primary w-full py-3 text-xs h-auto">
                {savingLeave ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Scheduling Leave…</span>
                  </>
                ) : (
                  <>
                    <CalendarX2 className="h-4 w-4" />
                    <span>Confirm & Apply Leave</span>
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Active Leaves Roster */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Recorded Time Off</h3>
                <p className="text-xs text-slate-500">Upcoming blocked dates across your clinic profile</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {leaves.length} Scheduled
              </span>
            </div>

            {leaves.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-xs">
                <CalendarX2 className="h-8 w-8 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm mt-3">No leaves recorded</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  You are currently marked available according to your regular weekly recurring shifts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 font-mono font-bold text-sm">
                        {leave.date.split('-')[2]}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">
                          {formatDate(leave.date)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {leave.reason || 'Personal / General Leave'}
                        </span>
                      </div>
                    </div>

                    <Button type="button" variant="ghost" size="xs" onClick={() => handleDeleteLeave(leave.id)} disabled={deletingLeaveId === leave.id} className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors flex items-center gap-1.5 h-auto">
                      {deletingLeaveId === leave.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Cancel Leave</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: LIVE SLOTS & OCCUPANCY DASHBOARD ─── */}
      {activeTab === 'occupancy' && (() => {
        const dayData = generatedSchedule.find((d) => d.date === selectedOccupancyDate);
        const daySlots = dayData?.slots || [];
        const isLeave = Boolean(dayData?.onLeave);

        let totalDaySlots = 0;
        let totalDayCapacity = 0;
        let totalDayBooked = 0;

        for (const shift of daySlots) {
          for (const ds of shift.dividedSlots || []) {
            totalDaySlots++;
            totalDayCapacity += ds.maxPatients || 0;
            totalDayBooked += ds.bookedCount || 0;
          }
        }

        const totalDayAvailable = Math.max(0, totalDayCapacity - totalDayBooked);
        const occupancyRate = totalDayCapacity > 0 ? Math.round((totalDayBooked / totalDayCapacity) * 100) : 0;

        const ribbonDates: Array<{
          dateStr: string;
          dayName: string;
          dayNum: string;
          monthName: string;
          hasShift: boolean;
          onLeave: boolean;
          bookedCount: number;
        }> = [];

        const [baseY, baseM, baseD] = getTodayIST().split('-').map(Number);
        for (let i = 0; i < 14; i++) {
          const d = new Date(baseY, baseM - 1, baseD + i);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStr = [y, m, day].join('-');

          const dayMatch = generatedSchedule.find((gs) => gs.date === dateStr);
          let bCount = 0;
          let hasS = false;
          if (dayMatch && dayMatch.slots && dayMatch.slots.length > 0) {
            hasS = true;
            for (const s of dayMatch.slots) {
              for (const ds of s.dividedSlots || []) {
                bCount += ds.bookedCount || 0;
              }
            }
          }

          ribbonDates.push({
            dateStr,
            dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
            dayNum: String(d.getDate()),
            monthName: d.toLocaleDateString('en-IN', { month: 'short' }),
            hasShift: hasS,
            onLeave: Boolean(dayMatch?.onLeave),
            bookedCount: bCount,
          });
        }

        return (
          <div className="space-y-6">
            {/* Header with Title and Refresh */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <Layers className="h-3.5 w-3.5" />
                  Clinical Capacity & Live Occupancy
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">Live Slot Roster & Bookings</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deep inspection into how your clinic shifts are divided into consultation slots and real-time patient occupancy.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={refreshFullSchedule}
                  disabled={refreshingSchedule}
                  className="rounded-xl border-slate-200 text-xs font-semibold hover:bg-slate-50 h-auto py-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshingSchedule ? 'animate-spin' : ''}`} />
                  <span>Refresh Bookings</span>
                </Button>
              </div>
            </div>

            {/* Date Ribbon Strip */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Select Calendar Date (14-Day Live Window)
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Showing: <strong className="text-slate-700">{formatDate(selectedOccupancyDate)}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {ribbonDates.map((rd) => {
                  const isSelected = rd.dateStr === selectedOccupancyDate;
                  return (
                    <button
                      key={rd.dateStr}
                      type="button"
                      onClick={() => setSelectedOccupancyDate(rd.dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] py-2.5 px-2 rounded-2xl border text-center transition-all shrink-0 ${
                        isSelected
                          ? 'border-blue-700 bg-blue-700 text-white shadow-sm ring-2 ring-blue-700/20'
                          : rd.onLeave
                          ? 'border-rose-200 bg-rose-50/60 text-rose-800 hover:border-rose-300'
                          : rd.hasShift
                          ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-white'
                          : 'border-dashed border-slate-200 bg-slate-50/40 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {rd.dayName}
                      </span>
                      <span className="text-lg font-black font-mono leading-tight my-0.5">
                        {rd.dayNum}
                      </span>
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                        {rd.monthName}
                      </span>

                      <div className="mt-1.5">
                        {rd.onLeave ? (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'}`}>
                            Leave
                          </span>
                        ) : rd.hasShift ? (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isSelected
                              ? 'bg-blue-800 text-blue-100'
                              : rd.bookedCount > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {rd.bookedCount > 0 ? `${rd.bookedCount} bkd` : 'Open'}
                          </span>
                        ) : (
                          <span className={`text-[9px] ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                            Off
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Clinical Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Shift Type</span>
                  <Sliders className="h-4 w-4 text-blue-600" />
                </div>
                <div className="mt-2 text-base font-bold text-slate-900">
                  {isLeave
                    ? 'Leave Day'
                    : dayData?.source === 'custom'
                    ? 'Special Override'
                    : dayData?.source === 'recurring'
                    ? 'Weekly Shift'
                    : 'No Shift Configured'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {isLeave ? 'Patients blocked' : daySlots.length > 0 ? `${daySlots.length} shift window(s)` : 'Clinic closed'}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Generated Slots</span>
                  <Clock className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="mt-2 text-2xl font-black font-mono text-slate-900">
                  {totalDaySlots} <span className="text-xs font-normal text-slate-500">slots</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {totalDayCapacity} patient capacity
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirmed Bookings</span>
                  <Users className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2 text-2xl font-black font-mono text-slate-900">
                  {totalDayBooked} <span className="text-xs font-normal text-slate-500">patients</span>
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                  {totalDayAvailable} remaining spots open
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fill Rate</span>
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-black font-mono text-slate-900">
                  {occupancyRate}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      occupancyRate >= 90 ? 'bg-rose-600' : occupancyRate >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Deep Slot-by-Slot Capacity Roster */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Slot Breakdown &amp; Occupancy for {formatDate(selectedOccupancyDate)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological consultation slots generated for this clinical shift with live booking counts
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 px-3 py-1 text-xs font-bold">
                  {totalDayBooked} / {totalDayCapacity} Booked
                </span>
              </div>

              {isLeave ? (
                <div className="p-8 text-center bg-rose-50/50 rounded-2xl border border-rose-200/70">
                  <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                  <h4 className="font-bold text-rose-900 text-sm">Doctor is on Leave</h4>
                  <p className="text-xs text-rose-700 max-w-md mx-auto mt-1">
                    You have marked this date as official leave. All slots are closed and existing patient bookings were protected.
                  </p>
                </div>
              ) : daySlots.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-800 text-sm">No Shifts Scheduled for this Day</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Patients cannot book consultations on {formatDate(selectedOccupancyDate)} because no regular weekly shift or date override is active.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setOverrideDate(selectedOccupancyDate);
                        setActiveTab('overrides');
                      }}
                      className="btn-primary text-xs h-auto py-2"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      <span>Open Special Shift for {formatDate(selectedOccupancyDate)}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {daySlots.map((shift, sIdx) => {
                    const isWave = shift.schedulingType === 'WAVE';
                    return (
                      <div key={shift.id || sIdx} className="space-y-3">
                        {/* Shift Window Banner */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            <span className="font-bold text-slate-900 text-xs">
                              Shift Window: {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isWave
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            }`}>
                              {isWave ? `WAVE (${shift.slotDuration}m slots)` : 'STREAM (Continuous Window)'}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-500 font-medium">
                            {shift.dividedSlots?.length || 0} slot(s) generated
                          </span>
                        </div>

                        {/* Divided Slots Grid */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(shift.dividedSlots || []).map((slot, idx) => {
                            const isFull = slot.bookedCount >= slot.maxPatients;
                            const isPartial = slot.bookedCount > 0 && !isFull;
                            const slotFillPct = slot.maxPatients > 0 ? Math.round((slot.bookedCount / slot.maxPatients) * 100) : 0;

                            return (
                              <div
                                key={idx}
                                className={`rounded-2xl border p-4 transition-all ${
                                  isFull
                                    ? 'border-rose-200 bg-rose-50/30'
                                    : isPartial
                                    ? 'border-amber-200 bg-amber-50/20'
                                    : 'border-slate-200 bg-white hover:border-blue-200 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-xs">
                                      #{idx + 1}
                                    </span>
                                    <div>
                                      <span className="font-mono text-sm font-extrabold text-slate-900 block">
                                        {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {isWave ? `${shift.slotDuration} mins consultation slot` : 'Continuous session token window'}
                                      </span>
                                    </div>
                                  </div>

                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isFull
                                      ? 'bg-rose-100 text-rose-800'
                                      : isPartial
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {isFull ? 'Fully Booked' : isPartial ? `${slot.availableCount} Spot Left` : 'Available'}
                                  </span>
                                </div>

                                {/* Live Occupancy Progress Bar */}
                                <div className="mt-3.5 space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-700 text-[11px]">
                                      Occupancy: <strong className="text-slate-900">{slot.bookedCount} / {slot.maxPatients}</strong> booked
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-slate-500">
                                      {slotFillPct}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        isFull ? 'bg-rose-600' : isPartial ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${slotFillPct}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Booked Patients Detail Roster */}
                                <div className="mt-3 pt-3 border-t border-slate-100/80">
                                  {slot.bookings && slot.bookings.length > 0 ? (
                                    <div className="space-y-1.5">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Confirmed Patients ({slot.bookings.length}):
                                      </span>
                                      <div className="space-y-1">
                                        {slot.bookings.map((b, bIdx) => (
                                          <div
                                            key={b.id || bIdx}
                                            className="flex items-center justify-between px-2.5 py-1.5 bg-white/90 rounded-xl border border-slate-200/70 text-xs"
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 font-mono">
                                                Token #{b.tokenNumber ?? (bIdx + 1)}
                                              </span>
                                              <span className="font-semibold text-slate-800 truncate max-w-[130px] sm:max-w-[160px]">
                                                {b.patientName}
                                              </span>
                                            </div>
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                              Confirmed
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                                      <span>0 patients booked</span>
                                      <span className="text-emerald-600 font-semibold text-[10px]">Ready for Booking</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── TAB 3: SPECIFIC DATE OVERRIDE ─── */}
      {activeTab === 'overrides' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Override Builder Form */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
                <Zap className="h-3.5 w-3.5" />
                Special Hours & Overrides
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">Open Special Date Slots</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add consultation slots for a specific date (e.g. holiday clinic, emergency evening session) without modifying your recurring schedule.
              </p>
            </div>

            <form onSubmit={handleCreateOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
                <Input type="date" min={getTodayIST()} value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Hour</label>
                  <Input type="time" value={overrideStartTime} onChange={(e) => setOverrideStartTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Hour</label>
                  <Input type="time" value={overrideEndTime} onChange={(e) => setOverrideEndTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto" required />
                </div>
              </div>

              {/* Model Selector for Override */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Consultation Scheduling Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setOverrideSchedulingType('WAVE'); if (overrideMaxPatients === 15) setOverrideMaxPatients(3); }} className={`p-2.5 rounded-xl border text-left transition-all ${
                      overrideSchedulingType === 'WAVE'
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900 ring-1 ring-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    } h-auto flex-col items-start`}>
                    <span className="block text-xs font-bold text-slate-900">WAVE</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Time slots with slot capacity</span>
                  </Button>

                  <Button type="button" variant="ghost" onClick={() => { setOverrideSchedulingType('STREAM'); if (overrideMaxPatients === 3) setOverrideMaxPatients(15); }} className={`p-2.5 rounded-xl border text-left transition-all ${
                      overrideSchedulingType === 'STREAM'
                        ? 'border-blue-700 bg-blue-50/70 text-slate-900 ring-1 ring-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    } h-auto flex-col items-start`}>
                    <span className="block text-xs font-bold text-slate-900">STREAM</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Continuous session capacity</span>
                  </Button>
                </div>
              </div>

              {overrideSchedulingType === 'WAVE' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Slot Duration</label>
                    <Select value={String(overrideDuration)} onValueChange={(val) => setOverrideDuration(Number(val))}>
                        <SelectTrigger className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto">
                          <SelectValue placeholder="Slot Duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 mins</SelectItem>
                          <SelectItem value="20">20 mins</SelectItem>
                          <SelectItem value="30">30 mins</SelectItem>
                          <SelectItem value="45">45 mins</SelectItem>
                          <SelectItem value="60">60 mins</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Buffer Time</label>
                    <Select value={String(overrideBuffer)} onValueChange={(val) => setOverrideBuffer(Number(val))}>
                        <SelectTrigger className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto">
                          <SelectValue placeholder="Buffer Time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 mins</SelectItem>
                          <SelectItem value="5">5 mins</SelectItem>
                          <SelectItem value="10">10 mins</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {overrideSchedulingType === 'WAVE' ? 'Capacity per Slot (Patients per Slot)' : 'Total Session Capacity (Patients for Window)'}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={overrideSchedulingType === 'WAVE' ? 20 : 100}
                  value={overrideMaxPatients}
                  onChange={(e) => setOverrideMaxPatients(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto"
                  required
                />
              </div>

              <Button type="submit" disabled={savingOverride} className="btn-primary w-full py-3 text-xs h-auto">
                {savingOverride ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Publishing Special Slots…</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Publish Special Date Slots</span>
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Right: Active Overrides Roster */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Active Date Overrides</h3>
                <p className="text-xs text-slate-500">Special shift hours taking precedence on specific calendar dates</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {customOverrides.length} Configured
              </span>
            </div>

            {customOverrides.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/90 bg-white p-12 text-center shadow-xs">
                <Sparkles className="h-8 w-8 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-800 text-sm mt-3">No date overrides configured</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All dates currently follow your weekly recurring schedule. Use the form on the left to set custom hours for any specific calendar date.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customOverrides.map((override) => {
                  const dayName = override.dayOfWeek ? (DAY_LABELS[override.dayOfWeek] || override.dayOfWeek) : '';
                  return (
                    <div
                      key={override.id}
                      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 font-bold shrink-0">
                          <span className="text-[10px] uppercase leading-tight font-semibold text-blue-500">{dayName}</span>
                          <span className="text-base font-black leading-tight font-mono">{override.date.split('-')[2]}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {formatDate(override.date)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              override.schedulingType === 'WAVE'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            }`}>
                              {override.schedulingType === 'WAVE' ? 'WAVE (Slots)' : 'STREAM (Window)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                            <span className="font-semibold text-slate-800 font-mono">
                              {formatTime(override.startTime)} – {formatTime(override.endTime)}
                            </span>
                            <span>•</span>
                            <span>
                              {override.schedulingType === 'WAVE'
                                ? `${override.slotDuration}m slots (${override.maxPatients ?? 3} patients/slot)`
                                : `Queue capacity: ${override.maxPatients ?? 10} patients`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDeleteOverride(override.id, override.date, override.startTime, override.endTime)}
                        disabled={deletingOverrideId === override.id}
                        className="self-end sm:self-center px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors flex items-center gap-1.5 h-auto"
                      >
                        {deletingOverrideId === override.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>Remove Override</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: BLOCK SPECIFIC HOURS / UNAVAILABLE ─── */}
      {activeTab === 'unavailable' && (
        <div className="max-w-2xl mx-auto rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              Emergency Block
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Block Hours on a Working Day</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark a time window or entire day as unavailable. Booked patients in that window are automatically safely rescheduled.
            </p>
          </div>

          <form onSubmit={handleSetUnavailable} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <Input type="date" min={getTodayIST()} value={unavailDate} onChange={(e) => setUnavailDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto" required />
            </div>

            <div className="flex items-center gap-2">
              <Input type="checkbox" id="fullDay" checked={isFullDayUnavail} onChange={(e) => setIsFullDayUnavail(e.target.checked)} className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 shadow-none border-slate-300 p-0 inline-block" />
              <label htmlFor="fullDay" className="text-xs font-bold text-slate-800">
                Block Entire Day
              </label>
            </div>

            {!isFullDayUnavail && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Block From</label>
                  <Input type="time" value={unavailStartTime} onChange={(e) => setUnavailStartTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Block Until</label>
                  <Input type="time" value={unavailEndTime} onChange={(e) => setUnavailEndTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 h-auto" />
                </div>
              </div>
            )}

            <Button type="submit" disabled={savingUnavail} className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 h-auto">
              {savingUnavail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Blocking & Rescheduling…</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <span>Block Time Window</span>
                </>
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
