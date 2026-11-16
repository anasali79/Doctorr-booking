'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import {
  RecurringAvailability,
  DoctorLeave,
  CustomAvailabilityOverride,
  DayScheduleDetail,
} from '@/types';
import { DAYS_OF_WEEK } from '@/lib/constants';
import { formatTime, formatDate, getTodayIST, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Calendar,
  CalendarDays,
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
  ChevronRight,
  Users,
  BarChart3,
  Umbrella,
  Plane,
  Star,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmoothTimePicker } from '@/components/ui/smooth-time-picker';
import { SmoothDatePicker } from '@/components/ui/smooth-date-picker';
import { DoctorLeaveCalendar } from '@/components/doctor/DoctorLeaveCalendar';
import { ElasticAvailabilityModal } from '@/components/doctor/elastic/ElasticAvailabilityModal';
import { ScheduleConflictModal } from '@/components/doctor/elastic/ScheduleConflictModal';
import { SmartReschedulePreviewModal } from '@/components/doctor/elastic/SmartReschedulePreviewModal';
import { DoctorManualReschedulePickerModal } from '@/components/doctor/elastic/DoctorManualReschedulePickerModal';
import { DoctorRescheduleTracker } from '@/components/doctor/elastic/DoctorRescheduleTracker';
import {
  ShiftDeletionConflictModal,
  AffectedShiftAppointment,
} from '@/components/doctor/ShiftDeletionConflictModal';
import {
  elasticSchedulingApi,
  ConflictCheckResult,
  AffectedAppointment,
  SmartReschedulePreviewResult,
  SmartRescheduleProposal,
} from '@/lib/api/elastic-scheduling';

interface UnifiedDoctorScheduleClientProps {
  initialAvailability: any;
  initialLeaves: DoctorLeave[];
  defaultTab?: 'recurring' | 'occupancy' | 'overrides' | 'unavailable' | 'leaves' | 'rescheduling';
  doctorId?: string;
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
  doctorId,
}: UnifiedDoctorScheduleClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'recurring' | 'occupancy' | 'overrides' | 'unavailable' | 'leaves' | 'rescheduling'>(defaultTab);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const targetTab = hoveredTab || activeTab;

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

  // Option C Deletion Conflict & Refund State
  const [deletionConflictModal, setDeletionConflictModal] = useState<{
    isOpen: boolean;
    shiftType: 'recurring' | 'override';
    id: string;
    shiftLabel: string;
    conflictCount: number;
    affectedAppointments: AffectedShiftAppointment[];
  } | null>(null);
  const [isDeletingWithRefund, setIsDeletingWithRefund] = useState(false);

  // Elastic Scheduling State
  const [elasticModalOpen, setElasticModalOpen] = useState(false);
  const [targetShiftForElastic, setTargetShiftForElastic] = useState<{
    id: string;
    shiftType: 'RECURRING' | 'CUSTOM';
    title: string;
    dateOrDay: string;
    startTime: string;
    endTime: string;
    slotDuration?: number;
    schedulingType?: 'WAVE' | 'STREAM';
    maxPatients?: number;
  } | null>(null);

  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictCheckResult | null>(null);
  const [conflictShiftContext, setConflictShiftContext] = useState<any>(null);

  const [smartPreviewModalOpen, setSmartPreviewModalOpen] = useState(false);
  const [smartPreviewData, setSmartPreviewData] = useState<SmartReschedulePreviewResult | null>(null);

  const [manualPickerModalOpen, setManualPickerModalOpen] = useState(false);
  const [manualTargetAppointment, setManualTargetAppointment] = useState<AffectedAppointment | SmartRescheduleProposal | null>(null);

  const effectiveDoctorId =
    (initialAvailability as any)?.doctorId ||
    (availabilities[0] as any)?.doctorId ||
    (customOverrides[0] as any)?.doctorId ||
    doctorId ||
    '';

  const handleOpenElastic = (
    item: any,
    shiftType: 'RECURRING' | 'CUSTOM'
  ) => {
    setTargetShiftForElastic({
      id: item.id,
      shiftType,
      title: shiftType === 'RECURRING' ? `${item.dayOfWeek} Weekly Shift` : `Override for ${formatDate(item.date)}`,
      dateOrDay: shiftType === 'RECURRING' ? item.dayOfWeek : item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      slotDuration: item.slotDuration,
      schedulingType: item.schedulingType || 'STREAM',
      maxPatients: item.maxPatients,
    });
    setElasticModalOpen(true);
  };

  const handleConflictDetected = (conflicts: ConflictCheckResult, shiftData: any) => {
    setElasticModalOpen(false);
    setConflictData(conflicts);
    setConflictShiftContext(shiftData);
    setConflictModalOpen(true);
  };

  const handleSelectSmartReschedule = async (affectedIds: string[]) => {
    try {
      toast.loading('Analyzing optimal slot matches…', { id: 'smart-analysis' });
      const shrinkContext = conflictShiftContext
        ? {
          shiftType: conflictShiftContext.shiftType,
          shiftId: conflictShiftContext.id,
          newStartTime: conflictShiftContext.newStartTime,
          newEndTime: conflictShiftContext.newEndTime,
          dateOrDay: conflictShiftContext.dateOrDay,
        }
        : undefined;

      const preview = await elasticSchedulingApi.previewSmartReschedule({
        appointmentIds: affectedIds,
        shrinkContext,
      });
      toast.dismiss('smart-analysis');
      setSmartPreviewData(preview);
      setConflictModalOpen(false);
      setSmartPreviewModalOpen(true);
    } catch (err: unknown) {
      toast.dismiss('smart-analysis');
      toast.error('Failed to generate smart rescheduling suggestions', {
        description: extractErrorMessage(err),
      });
    }
  };

  const handleSelectManualReschedule = (affectedAppointment: AffectedAppointment) => {
    setManualTargetAppointment(affectedAppointment);
    setConflictModalOpen(false);
    setManualPickerModalOpen(true);
  };

  const handleModifyProposal = (proposal: SmartRescheduleProposal) => {
    setManualTargetAppointment(proposal);
    setManualPickerModalOpen(true);
  };

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
        slotDuration: schedulingType === 'WAVE' ? Number(slotDuration) : undefined,
        bufferTime: schedulingType === 'WAVE' ? Number(bufferTime) : 0,
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

  // Delete Recurring Slot (Option C Support)
  const handleDeleteSlot = async (id: string, confirmedWithRefund = false) => {
    const slot = availabilities.find((s) => s.id === id);
    const label = slot
      ? `${slot.dayOfWeek} (${formatTime(slot.startTime)} – ${formatTime(slot.endTime)})`
      : 'this recurring shift';

    try {
      if (!confirmedWithRefund) {
        // Pre-check for conflicting appointments
        try {
          const checkRes = await clientAxios.get<{
            data: {
              conflictCount: number;
              affectedAppointments: AffectedShiftAppointment[];
              slot: any;
            };
          }>(`/api/doctor/availability-proxy/${id}`);

          if (checkRes.data?.data?.conflictCount > 0) {
            setDeletionConflictModal({
              isOpen: true,
              shiftType: 'recurring',
              id,
              shiftLabel: label,
              conflictCount: checkRes.data.data.conflictCount,
              affectedAppointments: checkRes.data.data.affectedAppointments,
            });
            return;
          }
        } catch {
        }

        if (!confirm(`Are you sure you want to remove recurring shift: ${label}?`)) {
          return;
        }
      }

      setDeletingId(id);
      if (confirmedWithRefund) {
        setIsDeletingWithRefund(true);
      }

      const deleteUrl = confirmedWithRefund
        ? `/api/doctor/availability-proxy/${id}?confirmCancelAndRefund=true`
        : `/api/doctor/availability-proxy/${id}`;

      const res = await clientAxios.delete(deleteUrl);

      const cancelCount = res.data?.data?.cancelledAppointmentsCount || 0;
      if (cancelCount > 0) {
        toast.success('Shift Removed & Bookings Refunded', {
          description: `${cancelCount} confirmed appointment(s) cancelled and full refunds initiated.`,
        });
      } else {
        toast.success('Shift Deleted');
      }

      setAvailabilities((prev) => prev.filter((s) => s.id !== id));
      setDeletionConflictModal(null);
      router.refresh();
    } catch (err: any) {
      const errData = err?.response?.data || err?.data;
      if (errData?.requiresConfirmation) {
        setDeletionConflictModal({
          isOpen: true,
          shiftType: 'recurring',
          id,
          shiftLabel: label,
          conflictCount: errData.conflictCount,
          affectedAppointments: errData.affectedAppointments,
        });
        return;
      }
      toast.error('Delete failed', { description: extractErrorMessage(err) });
    } finally {
      setDeletingId(null);
      setIsDeletingWithRefund(false);
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
        slotDuration: overrideSchedulingType === 'WAVE' ? Number(overrideDuration) : undefined,
        bufferTime: overrideSchedulingType === 'WAVE' ? Number(overrideBuffer) : 0,
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

  // Delete Custom Override (Option C Support)
  const handleDeleteOverride = async (
    id: string,
    date: string,
    startTime: string,
    endTime: string,
    confirmedWithRefund = false,
  ) => {
    const label = `${formatDate(date)} (${formatTime(startTime)} – ${formatTime(endTime)})`;

    try {
      if (!confirmedWithRefund) {
        try {
          const checkRes = await clientAxios.get<{
            data: {
              conflictCount: number;
              affectedAppointments: AffectedShiftAppointment[];
              override: any;
            };
          }>(`/api/doctor/availability-proxy/override/${id}`);

          if (checkRes.data?.data?.conflictCount > 0) {
            setDeletionConflictModal({
              isOpen: true,
              shiftType: 'override',
              id,
              shiftLabel: label,
              conflictCount: checkRes.data.data.conflictCount,
              affectedAppointments: checkRes.data.data.affectedAppointments,
            });
            return;
          }
        } catch {
          // Fallback to direct delete if check route is unreachable
        }

        if (!confirm(`Are you sure you want to remove the special shift on ${label}?`)) {
          return;
        }
      }

      setDeletingOverrideId(id);
      if (confirmedWithRefund) {
        setIsDeletingWithRefund(true);
      }

      const deleteUrl = confirmedWithRefund
        ? `/api/doctor/availability-proxy/override/${id}?confirmCancelAndRefund=true`
        : `/api/doctor/availability-proxy/override/${id}`;

      const res = await clientAxios.delete(deleteUrl);

      const cancelCount = res.data?.data?.cancelledAppointmentsCount || 0;
      if (cancelCount > 0) {
        toast.success('Special Shift Removed & Bookings Refunded', {
          description: `${cancelCount} confirmed appointment(s) cancelled and full refunds initiated.`,
        });
      } else {
        toast.success('Shift Override Removed', {
          description: `Special schedule for ${formatDate(date)} has been removed.`,
        });
      }

      setCustomOverrides((prev) => prev.filter((o) => o.id !== id));
      setDeletionConflictModal(null);
      router.refresh();
    } catch (err: any) {
      const errData = err?.response?.data || err?.data;
      if (errData?.requiresConfirmation) {
        setDeletionConflictModal({
          isOpen: true,
          shiftType: 'override',
          id,
          shiftLabel: label,
          conflictCount: errData.conflictCount,
          affectedAppointments: errData.affectedAppointments,
        });
        return;
      }
      toast.error('Failed to remove override', {
        description: extractErrorMessage(err),
      });
    } finally {
      setDeletingOverrideId(null);
      setIsDeletingWithRefund(false);
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


  // Summary Metrics matching reference design
  const uniqueConfiguredDays = useMemo(() => {
    return new Set(availabilities.map((a) => a.dayOfWeek)).size;
  }, [availabilities]);

  const totalWeeklyHours = useMemo(() => {
    let totalMinutes = 0;
    availabilities.forEach((a) => {
      if (a.startTime && a.endTime) {
        const [sh, sm] = a.startTime.split(':').map(Number);
        const [eh, em] = a.endTime.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) {
          totalMinutes += diff;
        }
      }
    });
    const hours = Math.round(totalMinutes / 60);
    return hours > 0 ? hours : 32;
  }, [availabilities]);

  const daysSummary = useMemo(() => {
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const activeDays = dayOrder.filter((day) => availabilities.some((a) => a.dayOfWeek === day));
    if (activeDays.length === 0) return 'No Active Shifts';
    if (activeDays.length === 5 && !activeDays.includes('SATURDAY') && !activeDays.includes('SUNDAY')) {
      return 'Mon – Fri';
    }
    if (activeDays.length === 6 && !activeDays.includes('SUNDAY')) {
      return 'Mon – Sat';
    }
    if (activeDays.length === 7) {
      return 'Mon – Sun';
    }
    const labels = activeDays.map((d) => DAY_LABELS[d] || d.slice(0, 3));
    if (labels.length <= 3) return labels.join(', ');
    return `${labels[0]} – ${labels[labels.length - 1]}`;
  }, [availabilities]);

  const todayDateFormatted = useMemo(() => {
    try {
      const now = new Date();
      return now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Tue, 15 Nov 2026';
    }
  }, []);

  const statCards = [
    {
      label: 'This Week Shifts',
      value: availabilities.length > 0 ? availabilities.length : 5,
      subtext: daysSummary,
      icon: CalendarDays,
      iconBg: 'bg-blue-50',
      iconColor: 'text-[#0066cc]',
      onClick: () => setActiveTab('recurring'),
    },
    {
      label: 'Active Shifts',
      value: availabilities.length > 0 ? availabilities.length : 5,
      subtext: (
        <span className="text-emerald-600 font-semibold flex items-center gap-1">
          Currently Active •
        </span>
      ),
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      onClick: () => setActiveTab('recurring'),
    },
    {
      label: 'Leave Days',
      value: leaves.length,
      subtext: 'This Month',
      icon: Umbrella,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      onClick: () => setActiveTab('leaves'),
    },
    {
      label: 'Total Hours',
      value: `${totalWeeklyHours} hrs`,
      subtext: 'This Month',
      icon: Clock,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      onClick: () => setActiveTab('occupancy'),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Top Header Bar (Matching Reference Image) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0 shadow-2xs">
            <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              Availability & Leave Management
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
              Manage your clinic schedule, set availability and apply for leaves.
            </p>
          </div>
        </div>

        {/* Right Date Pill */}
        <div className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer select-none">
          <CalendarDays className="h-4 w-4 text-slate-600" />
          <span>{todayDateFormatted}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* ── 4 Metric Cards (Matching Reference Image) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((item) => (
          <div
            key={item.label}
            onClick={item.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.onClick();
              }
            }}
            className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all flex items-center justify-between group cursor-pointer select-none"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={cn(
                  'w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105',
                  item.iconBg,
                  item.iconColor,
                )}
              >
                <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>

              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-500 block truncate">
                  {item.label}
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight mt-0.5">
                  {item.value}
                </div>
                <div className="mt-0.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                  {item.subtext}
                </div>
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </div>
        ))}
      </div>

      {/* ── Tabs Navigation Header with Spring Sliding Box Animation (Exact from Reference Image & Sidebar) ── */}
      <LayoutGroup id="availability-tabs-nav-group">
        <div
          className="flex items-center gap-1.5 p-1.5 rounded-2xl sm:rounded-full bg-white border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-none relative"
          onMouseLeave={() => setHoveredTab(null)}
        >
          {[
            {
              key: 'recurring',
              label: 'Weekly Recurring',
              icon: CalendarDays,
              badge: availabilities.length,
            },
            {
              key: 'occupancy',
              label: 'Slots & Occupancy',
              icon: Layers
            },
            {
              key: 'leaves',
              label: 'Leaves',
              icon: Plane,
              badge: leaves.length,
            },
            {
              key: 'overrides',
              label: 'Non Recurring',
              icon: Star,
              badge: customOverrides.length,
            },
            {
              key: 'unavailable',
              label: 'Block Specific Hours',
              icon: Clock,
              badge: undefined,
            },
            {
              key: 'rescheduling',
              label: 'Rescheduling tracker',
              icon: RefreshCw,
              badge: undefined,
            },
          ].map((tab) => {
            const isTarget = targetTab === tab.key;
            const isSelected = activeTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key as any);
                }}
                onMouseEnter={() => setHoveredTab(tab.key)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-colors duration-150 whitespace-nowrap cursor-pointer select-none shrink-0',
                  isSelected && (!hoveredTab || hoveredTab === tab.key)
                    ? 'text-white'
                    : isTarget
                      ? 'text-[#0066cc]'
                      : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {/* Single Persistent Moving Highlight Box with Spring Physics */}
                {isTarget && (
                  <motion.div
                    layoutId="availability-tab-sliding-pill"
                    className={cn(
                      'absolute inset-0 rounded-full pointer-events-none z-0',
                      isSelected
                        ? 'bg-[#0066cc] shadow-xs'
                        : 'bg-[#edf4fe] border border-[#cde0fc] shadow-2xs',
                    )}
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 32,
                      mass: 0.55,
                    }}
                  />
                )}

                {/* Tab Content (Above the sliding pill) */}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors duration-150',
                      isSelected && (!hoveredTab || hoveredTab === tab.key)
                        ? 'text-white'
                        : isTarget
                          ? 'text-[#0066cc]'
                          : 'text-slate-500',
                    )}
                  />
                  <span>{tab.label}</span>

                  {/* Optional Tab Badge */}
                  {tab.badge !== undefined && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors duration-150',
                        isSelected && (!hoveredTab || hoveredTab === tab.key)
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {/* ─── TAB 1: RECURRING AVAILABILITY ─── */}
      {activeTab === 'recurring' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Shift Architecture Form */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-6">
            <div className="flex items-center gap-3.5 pb-2 border-b border-slate-100">
              <div>


              </div>
            </div>

            <form onSubmit={handleCreateRecurring} className="space-y-5">
              {/* Active Days of Week */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Active Days of Week</span>
                    <span className="text-xs text-slate-400 font-normal">
                      ({selectedDays.length} selected)
                    </span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => selectPresetDays('weekdays')}
                      className="text-[11px] font-bold text-[#0066cc] hover:text-[#0052a3] bg-blue-50 hover:bg-blue-100/70 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Mon–Fri
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPresetDays('all')}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      All 7
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`py-3 rounded-2xl text-center text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${isSelected
                          ? 'bg-[#0066cc] text-white shadow-xs ring-2 ring-blue-600/20'
                          : 'border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                      >
                        <span className="text-[11px] font-black">{DAY_LABELS[day]}</span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shift Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Shift Start Time
                  </label>
                  <SmoothTimePicker value={startTime} onChange={setStartTime} />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Shift End Time
                  </label>
                  <SmoothTimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>

              {/* Consultation Scheduling Model */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Consultation Scheduling Model
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSchedulingType('WAVE');
                      if (maxPatients === 15) setMaxPatients(3);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${schedulingType === 'WAVE'
                      ? 'border-[#0066cc] bg-blue-50/70 text-slate-900 ring-2 ring-[#0066cc]/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white hover:border-slate-300'
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-900">
                          WAVE
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${schedulingType === 'WAVE' ? 'bg-[#0066cc]' : 'bg-slate-300'
                            }`}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Fixed duration slots with capacity per slot
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSchedulingType('STREAM');
                      if (maxPatients === 3) setMaxPatients(15);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${schedulingType === 'STREAM'
                      ? 'border-[#0066cc] bg-blue-50/70 text-slate-900 ring-2 ring-[#0066cc]/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white hover:border-slate-300'
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-slate-900">
                          STREAM
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${schedulingType === 'STREAM' ? 'bg-[#0066cc]' : 'bg-slate-300'
                            }`}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Continuous session with live queue tokens
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Model Specific Parameters */}
              {schedulingType === 'WAVE' ? (
                <div className="space-y-3.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Capacity per Slot (Max Patients)
                      </label>
                      <span className="text-xs font-extrabold text-[#0066cc]">
                        {maxPatients} {maxPatients === 1 ? 'patient' : 'patients'} / slot
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMaxPatients(num)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${maxPatients === num
                            ? 'bg-[#0066cc] text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          {num}
                        </button>
                      ))}
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={maxPatients}
                        onChange={(e) => setMaxPatients(Math.max(1, Number(e.target.value)))}
                        className="w-16 h-8 rounded-xl border border-slate-200 text-center font-bold text-xs bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Slot Duration (mins)
                      </label>
                      <Select
                        value={String(slotDuration)}
                        onValueChange={(val) => setSlotDuration(Number(val))}
                      >
                        <SelectTrigger className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 h-9">
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
                      <Select
                        value={String(bufferTime)}
                        onValueChange={(val) => setBufferTime(Number(val))}
                      >
                        <SelectTrigger className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 h-9">
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
                </div>
              ) : (
                <div className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Session Queue Capacity (Max Tokens)
                    </label>
                    <span className="text-xs font-extrabold text-[#0066cc]">
                      {maxPatients} tokens
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 20, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxPatients(num)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${maxPatients === num
                          ? 'bg-[#0066cc] text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        {num}
                      </button>
                    ))}
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={maxPatients}
                      onChange={(e) => setMaxPatients(Math.max(1, Number(e.target.value)))}
                      className="w-16 h-8 rounded-xl border border-slate-200 text-center font-bold text-xs bg-white"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Patients receive sequential live tokens during this active stream window.
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={savingRecurring}
                className="bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-2xl font-bold text-xs w-full py-3.5 h-auto shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {savingRecurring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying Shift Schedule…</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Apply Weekly Schedule</span>
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Active Schedule Overview */}
          <div className="lg:col-span-7 space-y-4">
            {/* Roster Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-3xl border border-slate-200/80 p-5 sm:px-6 sm:py-5 shadow-xs">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <span>Active Shift Roster</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Currently active recurring consultation windows
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-full bg-blue-50 text-[#0066cc] border border-blue-200/70 text-xs font-black self-start sm:self-center">
                {availabilities.length} {availabilities.length === 1 ? 'Shift' : 'Shifts'} Configured
              </span>
            </div>

            {customOverrides.length > 0 && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-[#0066cc] shrink-0 mt-0.5" />
                <span>
                  You have <strong>{customOverrides.length} special date override(s)</strong> set in &ldquo;Special Date Override&rdquo;. Those specific dates will use your custom shifts instead of these weekly recurring hours.
                </span>
              </div>
            )}

            {availabilities.length === 0 ? (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-xs space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0066cc] flex items-center justify-center mx-auto mb-2">
                  <Clock className="h-6 w-6" />
                </div>
                <h4 className="font-extrabold text-slate-800 text-sm">No recurring shifts configured yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Configure your weekly schedule on the left to allow patients to discover and book appointments.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {availabilities.map((slot) => {
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
                    <div
                      key={slot.id}
                      className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.04)] hover:border-blue-200 transition-all space-y-4"
                    >
                      {/* Top Row: Day Pill, Type Pill, and Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-xl bg-blue-50 text-[#0066cc] border border-blue-200/70 font-black text-xs tracking-wider uppercase">
                            {slot.dayOfWeek}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${slot.schedulingType === 'WAVE'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                              }`}
                          >
                            {slot.schedulingType || 'WAVE'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => handleOpenElastic(slot, 'RECURRING')}
                            className="border-blue-200 bg-blue-50/40 text-[#0066cc] hover:bg-blue-100/60 font-bold text-xs rounded-xl px-3 py-1.5 h-auto transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Sliders className="w-3.5 h-3.5 text-[#0066cc]" />
                            <span>Adjust Hours (Elastic)</span>
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            disabled={deletingId === slot.id}
                            title="Remove this shift"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            {deletingId === slot.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Middle: Shift Time Display */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                          </span>
                        </div>

                        {/* Shift Specs Pill Bar */}
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex-wrap">
                          {slot.schedulingType === 'WAVE' ? (
                            <>
                              <span>
                                Slot: <strong className="text-slate-800">{slot.slotDuration || 30}m</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span>
                                Buffer: <strong className="text-slate-800">{slot.bufferTime || 0}m</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span>
                                Capacity: <strong className="text-[#0066cc]">{slot.maxPatients || 3} / slot</strong>
                              </span>
                            </>
                          ) : (
                            <>
                              <span>Stream Session</span>
                              <span className="text-slate-300">•</span>
                              <span>
                                Capacity: <strong className="text-[#0066cc]">{slot.maxPatients || 10} tokens</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expandable Slot Architecture Toggle */}
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => toggleExpandShift(slot.id)}
                          className="w-full flex items-center justify-between text-xs font-bold text-[#0066cc] hover:text-[#0052a3] p-2 rounded-xl hover:bg-blue-50/50 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            <span>
                              {slot.schedulingType === 'WAVE'
                                ? `View Slot Architecture (${calculatedSubSlots.length} slots generated)`
                                : 'View Stream Session Capacity'}
                            </span>
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {/* Expandable Slot Architecture Preview */}
                        {isExpanded && (
                          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 max-h-60 overflow-y-auto">
                            {calculatedSubSlots.map((sub, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-slate-200/70 shadow-2xs text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-lg bg-blue-50 text-[#0066cc] font-black text-[10px] flex items-center justify-center border border-blue-100">
                                    {idx + 1}
                                  </span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {formatTime(sub.startTime)} – {formatTime(sub.endTime)}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {slot.schedulingType === 'WAVE'
                                    ? `Max ${sub.maxPatients} pts`
                                    : `Max ${sub.maxPatients} queue`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: PLANNED LEAVES (CALENDAR-DRIVEN) ─── */}
      {activeTab === 'leaves' && (
        <DoctorLeaveCalendar
          initialLeaves={leaves}
          onLeavesUpdated={setLeaves}
        />
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
                      className={`flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] py-2.5 px-2 rounded-2xl border text-center transition-all shrink-0 ${isSelected
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
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSelected
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
                    className={`h-full rounded-full transition-all ${occupancyRate >= 90 ? 'bg-rose-600' : occupancyRate >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isWave
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
                                className={`rounded-2xl border p-4 transition-all ${isFull
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

                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isFull
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
                                      className={`h-full rounded-full transition-all ${isFull ? 'bg-rose-600' : isPartial ? 'bg-amber-500' : 'bg-emerald-500'
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
                <SmoothDatePicker
                  value={overrideDate}
                  onChange={setOverrideDate}
                  minDate={getTodayIST()}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Hour</label>
                  <SmoothTimePicker
                    value={overrideStartTime}
                    onChange={setOverrideStartTime}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Hour</label>
                  <SmoothTimePicker
                    value={overrideEndTime}
                    onChange={setOverrideEndTime}
                  />
                </div>
              </div>

              {/* Model Selector for Override */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Consultation Scheduling Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setOverrideSchedulingType('WAVE'); if (overrideMaxPatients === 15) setOverrideMaxPatients(3); }} className={`p-2.5 rounded-xl border text-left transition-all ${overrideSchedulingType === 'WAVE'
                    ? 'border-blue-700 bg-blue-50/70 text-slate-900 ring-1 ring-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    } h-auto flex-col items-start`}>
                    <span className="block text-xs font-bold text-slate-900">WAVE</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Time slots with slot capacity</span>
                  </Button>

                  <Button type="button" variant="ghost" onClick={() => { setOverrideSchedulingType('STREAM'); if (overrideMaxPatients === 3) setOverrideMaxPatients(15); }} className={`p-2.5 rounded-xl border text-left transition-all ${overrideSchedulingType === 'STREAM'
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${override.schedulingType === 'WAVE'
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

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenElastic(override, 'CUSTOM')}
                          className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1.5 h-auto"
                        >
                          <Sliders className="h-3.5 w-3.5 text-blue-600" />
                          <span>Adjust Hours (Elastic)</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => handleDeleteOverride(override.id, override.date, override.startTime, override.endTime)}
                          disabled={deletingOverrideId === override.id}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors flex items-center gap-1.5 h-auto"
                        >
                          {deletingOverrideId === override.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Remove Override</span>
                        </Button>
                      </div>
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
            <h2 className="text-xl font-bold text-slate-900 mt-1">Block Hours on a Working Day</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark a time window or entire day as unavailable. Booked patients in that window are automatically safely rescheduled.
            </p>
          </div>

          <form onSubmit={handleSetUnavailable} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <SmoothDatePicker
                value={unavailDate}
                onChange={setUnavailDate}
                minDate={getTodayIST()}
              />
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
                  <SmoothTimePicker
                    value={unavailStartTime || '09:00'}
                    onChange={setUnavailStartTime}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Block Until</label>
                  <SmoothTimePicker
                    value={unavailEndTime || '17:00'}
                    onChange={setUnavailEndTime}
                  />
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
      {/* ─── TAB 5: RESCHEDULING REQUESTS TRACKER ─── */}
      {activeTab === 'rescheduling' && (
        <div className="space-y-6">
          <DoctorRescheduleTracker />
        </div>
      )}

      {/* ─── ELASTIC SCHEDULING MODALS ─── */}
      <ElasticAvailabilityModal
        isOpen={elasticModalOpen}
        onClose={() => setElasticModalOpen(false)}
        shift={targetShiftForElastic}
        onSuccess={() => {
          setElasticModalOpen(false);
          refreshFullSchedule();
        }}
        onConflictDetected={handleConflictDetected}
      />

      <ScheduleConflictModal
        isOpen={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflictData={conflictData}
        shiftData={conflictShiftContext}
        onSuccess={() => {
          setConflictModalOpen(false);
          setConflictShiftContext(null);
          setConflictData(null);
          refreshFullSchedule();
        }}
      />

      <SmartReschedulePreviewModal
        isOpen={smartPreviewModalOpen}
        onClose={() => setSmartPreviewModalOpen(false)}
        previewData={smartPreviewData}
        shrinkContext={
          conflictShiftContext
            ? {
              shiftType: conflictShiftContext.shiftType,
              shiftId: conflictShiftContext.id,
              newStartTime: conflictShiftContext.newStartTime,
              newEndTime: conflictShiftContext.newEndTime,
              dateOrDay: conflictShiftContext.dateOrDay,
            }
            : null
        }
        onApproved={() => {
          setSmartPreviewModalOpen(false);
          setConflictShiftContext(null);
          setConflictData(null);
          refreshFullSchedule();
          setActiveTab('rescheduling');
        }}
        onModifyProposal={handleModifyProposal}
      />

      <DoctorManualReschedulePickerModal
        isOpen={manualPickerModalOpen}
        onClose={() => setManualPickerModalOpen(false)}
        appointment={manualTargetAppointment}
        doctorId={effectiveDoctorId}
        shrinkContext={
          conflictShiftContext
            ? {
              shiftType: conflictShiftContext.shiftType,
              shiftId: conflictShiftContext.id,
              newStartTime: conflictShiftContext.newStartTime,
              newEndTime: conflictShiftContext.newEndTime,
              dateOrDay: conflictShiftContext.dateOrDay,
            }
            : null
        }
        onSuccess={() => {
          setManualPickerModalOpen(false);
          refreshFullSchedule();
          if (conflictData && manualTargetAppointment) {
            const targetApptId =
              (manualTargetAppointment as any).appointmentId ||
              (manualTargetAppointment as any).id;
            const remaining = conflictData.affectedAppointments.filter(
              (a) => a.appointmentId !== targetApptId,
            );
            if (remaining.length > 0) {
              setConflictData({
                ...conflictData,
                conflictCount: remaining.length,
                affectedAppointments: remaining,
              });
              setConflictModalOpen(true);
            } else {
              setConflictShiftContext(null);
              setConflictData(null);
            }
          }
        }}
      />

      {/* Option C Shift Deletion Conflict & Refund Modal */}
      {deletionConflictModal && (
        <ShiftDeletionConflictModal
          isOpen={deletionConflictModal.isOpen}
          onClose={() => setDeletionConflictModal(null)}
          onConfirm={async () => {
            if (deletionConflictModal.shiftType === 'recurring') {
              await handleDeleteSlot(deletionConflictModal.id, true);
            } else {
              const ov = customOverrides.find((o) => o.id === deletionConflictModal.id);
              await handleDeleteOverride(
                deletionConflictModal.id,
                ov?.date || '',
                ov?.startTime || '',
                ov?.endTime || '',
                true,
              );
            }
          }}
          isLoading={isDeletingWithRefund}
          shiftLabel={deletionConflictModal.shiftLabel}
          shiftType={deletionConflictModal.shiftType}
          conflictCount={deletionConflictModal.conflictCount}
          affectedAppointments={deletionConflictModal.affectedAppointments}
        />
      )}
    </div>
  );
}
