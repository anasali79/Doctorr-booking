'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Appointment } from '@/types';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { formatTime, formatDate, getTodayIST } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CalendarSync,
  Clock,
  Calendar,
  Check,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  User,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DoctorRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  doctorId?: string;
  onRescheduled: () => void;
}

interface SmartSlotOption {
  date: string;
  startTime: string;
  endTime: string;
  tag: string;
  isToday: boolean;
  isTomorrow: boolean;
}

interface RawSlot {
  startTime: string;
  endTime: string;
  status: string;
}

export function DoctorRescheduleModal({
  isOpen,
  onClose,
  appointment,
  doctorId,
  onRescheduled,
}: DoctorRescheduleModalProps) {
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [smartSlots, setSmartSlots] = useState<SmartSlotOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Manual picker state
  const [manualDate, setManualDate] = useState<string>('');
  const [manualSlots, setManualSlots] = useState<RawSlot[]>([]);
  const [loadingManualSlots, setLoadingManualSlots] = useState(false);
  const [showManualPicker, setShowManualPicker] = useState(false);

  // Reason & Submission
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const resolvedDoctorId =
    appointment?.doctorId || (appointment as any)?.doctor?.id || doctorId;

  // Helper: Add days to YYYY-MM-DD
  const addDays = (dateStr: string, days: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const ny = date.getFullYear();
    const nm = String(date.getMonth() + 1).padStart(2, '0');
    const nd = String(date.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  };

  // Helper: Format relative day
  const getRelativeDayLabel = (dateStr: string, todayStr: string): string => {
    if (dateStr === todayStr) return 'Today';
    if (dateStr === addDays(todayStr, 1)) return 'Tomorrow';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const parseSlotData = (res: any): RawSlot[] => {
    const d = res?.data?.data || res?.data;
    return Array.isArray(d) ? d : [];
  };

  const isSlotBookable = (status?: string): boolean => {
    if (!status) return false;
    const s = status.toLowerCase().trim();
    return (
      s === 'available' ||
      s === 'cancel and available for booking' ||
      s === 'cancel_and_available' ||
      s === 'open'
    );
  };

  // 1. Fetch smart 3-day slot suggestions when modal opens
  const fetchSmartSuggestions = useCallback(async () => {
    if (!appointment || !resolvedDoctorId) return;
    setLoadingSuggestions(true);
    setSmartSlots([]);
    setSelectedSlot(null);

    const todayStr = getTodayIST();
    // Start from original appointment date or today (whichever is later)
    const baseDate = appointment.date >= todayStr ? appointment.date : todayStr;
    const day1 = baseDate;
    const day2 = addDays(baseDate, 1);
    const day3 = addDays(baseDate, 2);

    try {
      const [res1, res2, res3] = await Promise.all([
        clientAxios
          .get(`/api/doctor/${resolvedDoctorId}/slots-proxy?date=${day1}`)
          .catch(() => ({ data: { data: [] } })),
        clientAxios
          .get(`/api/doctor/${resolvedDoctorId}/slots-proxy?date=${day2}`)
          .catch(() => ({ data: { data: [] } })),
        clientAxios
          .get(`/api/doctor/${resolvedDoctorId}/slots-proxy?date=${day3}`)
          .catch(() => ({ data: { data: [] } })),
      ]);

      const slots1: RawSlot[] = parseSlotData(res1);
      const slots2: RawSlot[] = parseSlotData(res2);
      const slots3: RawSlot[] = parseSlotData(res3);

      const now = new Date();
      const currentHoursMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const filterValidSlots = (slots: RawSlot[], dateStr: string): RawSlot[] => {
        return slots.filter((s) => {
          if (!isSlotBookable(s.status)) return false;
          if (dateStr === appointment.date && s.startTime === appointment.startTime) return false;
          if (dateStr === todayStr && s.startTime <= currentHoursMin) return false;
          return true;
        });
      };

      const validDay1 = filterValidSlots(slots1, day1);
      const validDay2 = filterValidSlots(slots2, day2);
      const validDay3 = filterValidSlots(slots3, day3);

      const suggestions: SmartSlotOption[] = [];

      // Day 1 Slots (Same-day best slots)
      if (validDay1.length > 0) {
        // Earliest available on Day 1
        suggestions.push({
          date: day1,
          startTime: validDay1[0].startTime,
          endTime: validDay1[0].endTime,
          tag: day1 === todayStr ? 'Today (Earliest)' : 'Same Day (Earliest)',
          isToday: day1 === todayStr,
          isTomorrow: day1 === addDays(todayStr, 1),
        });
        // Second slot on Day 1 if exists
        if (validDay1.length > 1) {
          const secondSlot = validDay1[Math.min(2, validDay1.length - 1)];
          suggestions.push({
            date: day1,
            startTime: secondSlot.startTime,
            endTime: secondSlot.endTime,
            tag: day1 === todayStr ? 'Today (Next Free)' : 'Same Day (Afternoon)',
            isToday: day1 === todayStr,
            isTomorrow: day1 === addDays(todayStr, 1),
          });
        }
      }

      // Day 2 Slots (Next day morning & midday)
      if (validDay2.length > 0) {
        suggestions.push({
          date: day2,
          startTime: validDay2[0].startTime,
          endTime: validDay2[0].endTime,
          tag: day2 === addDays(todayStr, 1) ? 'Tomorrow (Morning)' : `${getRelativeDayLabel(day2, todayStr)} (Morning)`,
          isToday: false,
          isTomorrow: day2 === addDays(todayStr, 1),
        });

        if (suggestions.length < 4 && validDay2.length > 1) {
          const midSlot = validDay2[Math.floor(validDay2.length / 2)];
          if (midSlot.startTime !== validDay2[0].startTime) {
            suggestions.push({
              date: day2,
              startTime: midSlot.startTime,
              endTime: midSlot.endTime,
              tag: day2 === addDays(todayStr, 1) ? 'Tomorrow (Midday)' : `${getRelativeDayLabel(day2, todayStr)} (Midday)`,
              isToday: false,
              isTomorrow: day2 === addDays(todayStr, 1),
            });
          }
        }

        // If suggestions still < 3 and Day 2 has more slots, add an evening slot from Day 2
        if (suggestions.length < 3 && validDay2.length > 2) {
          const lastSlot = validDay2[validDay2.length - 1];
          if (!suggestions.some((s) => s.date === day2 && s.startTime === lastSlot.startTime)) {
            suggestions.push({
              date: day2,
              startTime: lastSlot.startTime,
              endTime: lastSlot.endTime,
              tag: day2 === addDays(todayStr, 1) ? 'Tomorrow (Evening)' : `${getRelativeDayLabel(day2, todayStr)} (Evening)`,
              isToday: false,
              isTomorrow: day2 === addDays(todayStr, 1),
            });
          }
        }
      }

      // Day 3 Slots
      if (suggestions.length < 4 && validDay3.length > 0) {
        suggestions.push({
          date: day3,
          startTime: validDay3[0].startTime,
          endTime: validDay3[0].endTime,
          tag: `${getRelativeDayLabel(day3, todayStr)} (Morning)`,
          isToday: false,
          isTomorrow: false,
        });

        if (suggestions.length < 4 && validDay3.length > 2) {
          const midSlot = validDay3[Math.floor(validDay3.length / 2)];
          suggestions.push({
            date: day3,
            startTime: midSlot.startTime,
            endTime: midSlot.endTime,
            tag: `${getRelativeDayLabel(day3, todayStr)} (Afternoon)`,
            isToday: false,
            isTomorrow: false,
          });
        }
      }

      setSmartSlots(suggestions.slice(0, 4));

      // Auto-select the 1st recommendation by default if available
      if (suggestions.length > 0) {
        setSelectedSlot({
          date: suggestions[0].date,
          startTime: suggestions[0].startTime,
          endTime: suggestions[0].endTime,
        });
      }
    } catch (err) {
      console.error('Failed to fetch smart slot suggestions', err);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [appointment, resolvedDoctorId]);

  useEffect(() => {
    if (isOpen && appointment) {
      setRescheduleReason('');
      setShowManualPicker(false);
      const todayStr = getTodayIST();
      setManualDate(appointment.date >= todayStr ? appointment.date : todayStr);
      fetchSmartSuggestions();
    }
  }, [isOpen, appointment, fetchSmartSuggestions]);

  // 2. Fetch manual slots when user changes manual date
  const fetchManualSlots = useCallback(
    async (dateStr: string) => {
      if (!resolvedDoctorId || !dateStr) return;
      setLoadingManualSlots(true);
      try {
        const res = await clientAxios.get(
          `/api/doctor/${resolvedDoctorId}/slots-proxy?date=${dateStr}`,
        );
        const slots: RawSlot[] = parseSlotData(res);
        const todayStr = getTodayIST();
        const now = new Date();
        const currentHoursMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const filtered = slots.filter((s) => {
          if (!isSlotBookable(s.status)) return false;
          if (dateStr === appointment?.date && s.startTime === appointment?.startTime) return false;
          if (dateStr === todayStr && s.startTime <= currentHoursMin) return false;
          return true;
        });

        setManualSlots(filtered);
      } catch (err) {
        toast.error('Failed to load slots for ' + dateStr);
        setManualSlots([]);
      } finally {
        setLoadingManualSlots(false);
      }
    },
    [appointment, resolvedDoctorId],
  );

  const handleManualDateSelect = (newDate: string) => {
    setManualDate(newDate);
    fetchManualSlots(newDate);
  };

  // Group manual slots by period
  const groupedManualSlots = useMemo(() => {
    const morning: RawSlot[] = [];
    const afternoon: RawSlot[] = [];
    const evening: RawSlot[] = [];

    manualSlots.forEach((slot) => {
      const hour = parseInt(slot.startTime.split(':')[0], 10);
      if (hour < 12) morning.push(slot);
      else if (hour < 17) afternoon.push(slot);
      else evening.push(slot);
    });

    return { morning, afternoon, evening };
  }, [manualSlots]);

  // 3. Confirm Reschedule
  const handleConfirmReschedule = async () => {
    if (!appointment || !selectedSlot) {
      toast.error('Please choose a new time slot to reschedule');
      return;
    }

    try {
      setSubmitting(true);
      await clientAxios.patch(
        `/api/doctor/appointments/${appointment.id}/reschedule`,
        {
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          rescheduleReason:
            rescheduleReason.trim() || 'Schedule adjustment by doctor',
        },
      );

      toast.success(
        `Appointment successfully rescheduled to ${formatDate(selectedSlot.date)} at ${formatTime(selectedSlot.startTime)}. Patient has been notified.`,
      );
      onRescheduled();
      onClose();
    } catch (err: unknown) {
      toast.error('Reschedule Failed', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const todayStr = getTodayIST();
  const nextDates = Array.from({ length: 7 }, (_, i) => addDays(todayStr, i));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-100/70 text-[#0066cc] flex items-center justify-center shrink-0 border border-blue-200">
              <CalendarSync className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Reschedule Patient Appointment
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select from smart recommendations or choose a custom slot
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Current Patient & Appointment Info Banner */}
          <div className="rounded-2xl p-3.5 bg-blue-50/70 border border-blue-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-white text-blue-700 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200 shadow-2xs">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate text-sm">
                  {appointment.patient?.fullName || 'Patient'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Phone: {appointment.patient?.phone || '—'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Original Booking
              </span>
              <p className="font-semibold text-slate-800 text-xs mt-0.5">
                {formatDate(appointment.date)} • {formatTime(appointment.startTime)}
              </p>
            </div>
          </div>

          {/* ⚡ Smart Recommendations Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                <span>Recommended Next Slots (Next 3 Days)</span>
              </label>
              {loadingSuggestions && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking free slots...
                </span>
              )}
            </div>

            {loadingSuggestions ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl border border-slate-100 bg-slate-50/60 animate-pulse"
                  />
                ))}
              </div>
            ) : smartSlots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 p-4 text-center space-y-1">
                <AlertCircle className="h-4 w-4 text-amber-600 mx-auto" />
                <p className="font-medium text-slate-700">No immediate slots free in the next 3 days</p>
                <p className="text-[11px] text-slate-500">
                  Please use the manual date selector below to pick an available date.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {smartSlots.map((opt, idx) => {
                  const isSelected =
                    selectedSlot?.date === opt.date &&
                    selectedSlot?.startTime === opt.startTime;

                  return (
                    <div
                      key={idx}
                      onClick={() =>
                        setSelectedSlot({
                          date: opt.date,
                          startTime: opt.startTime,
                          endTime: opt.endTime,
                        })
                      }
                      className={`relative p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#0066cc] bg-blue-50/80 ring-2 ring-[#0066cc]/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                          {opt.tag}
                        </span>
                        {isSelected && (
                          <span className="h-4 w-4 rounded-full bg-[#0066cc] text-white flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 space-y-0.5">
                        <div className="font-bold text-slate-900 text-xs">
                          {formatDate(opt.date)}
                        </div>
                        <div className="font-semibold text-[#0066cc] text-[11px] flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>
                            {formatTime(opt.startTime)} – {formatTime(opt.endTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 📅 Or Choose Custom Date Section */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <button
              type="button"
              onClick={() => {
                const nextState = !showManualPicker;
                setShowManualPicker(nextState);
                if (nextState && manualSlots.length === 0) {
                  fetchManualSlots(manualDate || todayStr);
                }
              }}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-[#0066cc] py-1 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>Or select another date manually</span>
              </span>
              <span className="text-[11px] font-semibold text-[#0066cc]">
                {showManualPicker ? 'Hide Manual Picker' : 'Browse Calendar & Slots →'}
              </span>
            </button>

            {showManualPicker && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                {/* Horizontal Date Picker */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                    Select Date (Next 7 Days):
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {nextDates.map((d) => {
                      const isDateActive = manualDate === d;
                      const [yr, mo, dy] = d.split('-').map(Number);
                      const dayObj = new Date(yr, mo - 1, dy);
                      const weekday = dayObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                      });
                      const dayNum = dy;

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleManualDateSelect(d)}
                          className={`flex flex-col items-center justify-center min-w-13 py-2 px-2 rounded-2xl text-center transition-all cursor-pointer ${
                            isDateActive
                              ? 'bg-[#0066cc] text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-bold opacity-80">
                            {d === todayStr ? 'Today' : weekday}
                          </span>
                          <span className="text-sm font-extrabold">{dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slots for selected date */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Available Slots on {formatDate(manualDate)}:
                    </span>
                    {loadingManualSlots && (
                      <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                    )}
                  </div>

                  {loadingManualSlots ? (
                    <div className="py-6 text-center text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                      Loading slots...
                    </div>
                  ) : manualSlots.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
                      No free slots available on {formatDate(manualDate)}. Please select another date above.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {/* Morning */}
                      {groupedManualSlots.morning.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Morning
                          </span>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {groupedManualSlots.morning.map((s, idx) => {
                              const isSel =
                                selectedSlot?.date === manualDate &&
                                selectedSlot?.startTime === s.startTime;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedSlot({
                                      date: manualDate,
                                      startTime: s.startTime,
                                      endTime: s.endTime,
                                    })
                                  }
                                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                                    isSel
                                      ? 'border-[#0066cc] bg-[#0066cc] text-white shadow-xs'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {formatTime(s.startTime)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Afternoon */}
                      {groupedManualSlots.afternoon.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Afternoon
                          </span>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {groupedManualSlots.afternoon.map((s, idx) => {
                              const isSel =
                                selectedSlot?.date === manualDate &&
                                selectedSlot?.startTime === s.startTime;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedSlot({
                                      date: manualDate,
                                      startTime: s.startTime,
                                      endTime: s.endTime,
                                    })
                                  }
                                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                                    isSel
                                      ? 'border-[#0066cc] bg-[#0066cc] text-white shadow-xs'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {formatTime(s.startTime)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Evening */}
                      {groupedManualSlots.evening.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Evening
                          </span>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {groupedManualSlots.evening.map((s, idx) => {
                              const isSel =
                                selectedSlot?.date === manualDate &&
                                selectedSlot?.startTime === s.startTime;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedSlot({
                                      date: manualDate,
                                      startTime: s.startTime,
                                      endTime: s.endTime,
                                    })
                                  }
                                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                                    isSel
                                      ? 'border-[#0066cc] bg-[#0066cc] text-white shadow-xs'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {formatTime(s.startTime)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* New Slot Preview Card */}
          {selectedSlot && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <Check className="h-3 w-3 stroke-[3]" />
                Selected Reschedule Target
              </span>

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Previous</span>
                  <span className="line-through text-slate-500 font-medium">
                    {formatDate(appointment.date)} ({formatTime(appointment.startTime)})
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="text-right">
                  <span className="text-emerald-700 font-bold block text-[10px]">New Appointment</span>
                  <span className="font-extrabold text-emerald-950 text-sm">
                    {formatDate(selectedSlot.date)} • {formatTime(selectedSlot.startTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Reschedule Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              Doctor Note / Reason for Patient (Optional)
            </label>
            <Input
              type="text"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="e.g. Schedule adjustment / Emergency clinic timing"
              className="text-xs rounded-xl"
            />
            <p className="text-[10px] text-slate-400">
              This note will be included in the patient&apos;s SMS, WhatsApp, and Email notification.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/80">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleConfirmReschedule}
            disabled={!selectedSlot || submitting}
            className="btn-primary !text-xs !py-2 !px-4 h-auto rounded-xl flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Rescheduling...</span>
              </>
            ) : (
              <>
                <CalendarSync className="h-3.5 w-3.5" />
                <span>Confirm Reschedule</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
