'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatTime, formatDate, getTodayIST } from '@/lib/utils';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import {
  elasticSchedulingApi,
  AffectedAppointment,
  SmartRescheduleProposal,
  ShrinkShiftContext,
} from '@/lib/api/elastic-scheduling';
import { Slot } from '@/types';
import {
  Clock,
  Calendar,
  CheckCircle2,
  Loader2,
  AlertCircle,
  User,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface DoctorManualReschedulePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AffectedAppointment | SmartRescheduleProposal | null;
  doctorId: string;
  shrinkContext?: ShrinkShiftContext | null;
  onSuccess: () => void;
}

export function DoctorManualReschedulePickerModal({
  isOpen,
  onClose,
  appointment,
  doctorId,
  shrinkContext,
  onSuccess,
}: DoctorManualReschedulePickerModalProps) {
  const todayStr = getTodayIST();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState<string>('Clinic schedule update');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (appointment) {
      const origDate = (appointment as any).originalDate || (appointment as any).date || todayStr;
      const initialDate = origDate >= todayStr ? origDate : todayStr;
      setSelectedDate(initialDate);
    }
  }, [appointment, todayStr]);

  // Fetch available slots for selected date
  const targetDoctorId = (appointment as any)?.doctorId || doctorId;

  useEffect(() => {
    if (!isOpen || !targetDoctorId || !selectedDate) return;

    let cancelled = false;
    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);
        const res = await clientAxios.get<{ data: Slot[] }>(
          `/api/doctor/${targetDoctorId}/slots-proxy`,
          { params: { date: selectedDate } },
        );
        if (!cancelled) {
          let list = res.data?.data || [];

          // 1. Filter out the exact same slot being vacated
          const origDate = (appointment as any).originalDate || (appointment as any).date;
          const origStart = (appointment as any).originalStartTime || (appointment as any).startTime;
          if (origDate && origStart && selectedDate === origDate) {
            list = list.filter((s) => s.startTime !== origStart);
          }

          // 2. Filter out slots falling in the clipped/shrunk period
          if (shrinkContext) {
            const [y, m, d] = selectedDate.split('-').map(Number);
            const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            const dayName = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

            const isRecurring = String(shrinkContext.shiftType).toUpperCase() === 'RECURRING';
            const isCustom = String(shrinkContext.shiftType).toUpperCase() === 'CUSTOM';

            const matchesRecurring =
              isRecurring && shrinkContext.dateOrDay?.toUpperCase() === dayName;
            const matchesCustom =
              isCustom && shrinkContext.dateOrDay === selectedDate;

            if (matchesRecurring || matchesCustom) {
              const toM = (t: string) => {
                const [h, min] = t.split(':').map(Number);
                return h * 60 + min;
              };
              const shrinkStartM = toM(shrinkContext.newStartTime);
              const shrinkEndM = toM(shrinkContext.newEndTime);

              list = list.filter((s) => {
                const sStart = toM(s.startTime);
                const sEnd = toM(s.endTime);
                return sStart >= shrinkStartM && sEnd <= shrinkEndM;
              });
            }
          }

          setSlots(list);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setSlots([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      }
    };

    fetchSlots();
    return () => {
      cancelled = true;
    };
  }, [isOpen, targetDoctorId, selectedDate, shrinkContext, appointment]);

  if (!appointment) return null;

  const apptSchedulingType = appointment.schedulingType || 'STREAM';

  const isBookable = (status?: string): boolean => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s === 'available' || s === 'cancel and available for booking';
  };

  const handleSelectSlot = (slot: Slot) => {
    if (!isBookable(slot.status)) return;
    setSelectedSlot(slot);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      toast.error('Please select an available time slot');
      return;
    }

    try {
      setSubmitting(true);
      await elasticSchedulingApi.manualReschedule({
        appointmentId: appointment.appointmentId,
        proposedDate: selectedDate,
        proposedStartTime: selectedSlot.startTime,
        proposedEndTime: selectedSlot.endTime,
        doctorReason: reason || 'Manual rescheduling by doctor',
        shrinkContext: shrinkContext || undefined,
      });

      toast.success('Rescheduling Request Created!', {
        description: `Reserved ${formatDate(selectedDate)} at ${formatTime(selectedSlot.startTime)} and sent proposal to ${appointment.patientName}.`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to create manual reschedule request', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-white border border-slate-200 shadow-2xl rounded-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-slate-200 bg-slate-50">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Manual Slot Assignment: {appointment.patientName}
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
            <span>
              Original:{' '}
              {formatDate((appointment as any).originalDate || (appointment as any).date)} at{' '}
              {formatTime((appointment as any).originalStartTime || (appointment as any).startTime)}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase text-slate-600">
              {apptSchedulingType}
            </Badge>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Replacement Date
            </label>
            <Input
              type="date"
              min={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-mono text-sm"
              required
            />
          </div>

          {/* Slots Browser */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Available Opening Slots on {formatDate(selectedDate)}
              </label>
              {loadingSlots && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability...
                </span>
              )}
            </div>

            {loadingSlots ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Loading compatible openings...
              </div>
            ) : slots.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No slots available on this date. Please select a different date.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                {slots.map((s, idx) => {
                  const bookable = isBookable(s.status);
                  const isSelected =
                    selectedSlot?.startTime === s.startTime &&
                    selectedSlot?.endTime === s.endTime;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!bookable}
                      onClick={() => handleSelectSlot(s)}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30'
                          : bookable
                          ? 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                          : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold font-mono text-slate-900">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          s.schedulingType === 'WAVE'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {s.schedulingType || 'STREAM'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] w-full">
                        <span
                          className={`font-semibold ${
                            bookable ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {bookable ? 'Available' : 'Booked'}
                        </span>
                        {s.availableCount !== undefined && (
                          <span className="text-slate-500 font-mono font-medium">
                            {s.availableCount} / {s.maxPatients || (s.schedulingType === 'WAVE' ? 3 : 10)} spots
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Doctor Note / Reschedule Reason
            </label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Doctor shift rescheduled"
              className="text-xs"
            />
          </div>

          {/* Selected Slot Summary */}
          {selectedSlot && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
              <div>
                <span className="font-semibold block">Proposed Slot:</span>
                <span className="font-mono font-medium">
                  {formatDate(selectedDate)} at {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
                </span>
              </div>
              <Badge className="bg-blue-600 text-white text-[10px]">
                Will be reserved atomically
              </Badge>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !selectedSlot}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Holding Slot...
                </>
              ) : (
                'Create Request & Reserve Slot'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
