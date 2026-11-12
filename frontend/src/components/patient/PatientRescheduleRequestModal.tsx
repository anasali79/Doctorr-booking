'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatTime, formatDate, formatDateTime, getTodayIST } from '@/lib/utils';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import {
  elasticSchedulingApi,
  RescheduleRequestRecord,
  PatientAlternativesResult,
  PatientAlternativeSlot,
} from '@/lib/api/elastic-scheduling';
import { Slot } from '@/types';
import {
  AlertCircle,
  Calendar,
  Clock,
  CheckCircle2,
  RotateCcw,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface PatientRescheduleRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RescheduleRequestRecord | null;
  onSuccess: () => void;
}

export function PatientRescheduleRequestModal({
  isOpen,
  onClose,
  request,
  onSuccess,
}: PatientRescheduleRequestModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  // Prioritized alternatives state
  const [loadingAlternatives, setLoadingAlternatives] = useState<boolean>(false);
  const [alternativesData, setAlternativesData] = useState<PatientAlternativesResult | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    schedulingType?: string;
  } | null>(null);

  // Custom date picker fallback state
  const todayStr = getTodayIST();
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [customSlots, setCustomSlots] = useState<Slot[]>([]);
  const [loadingCustomSlots, setLoadingCustomSlots] = useState<boolean>(false);

  // Cancellation state
  const [cancelReason, setCancelReason] = useState<string>('Doctor schedule changed');

  // Load prioritized alternatives on open
  useEffect(() => {
    if (!isOpen || !request) {
      setAlternativesData(null);
      setSelectedSlot(null);
      setShowCustomDatePicker(false);
      setShowCancelConfirm(false);
      return;
    }

    let isMounted = true;
    const fetchAlternatives = async () => {
      try {
        setLoadingAlternatives(true);
        const data = await elasticSchedulingApi.getPatientAlternatives(request.id);
        if (isMounted) {
          setAlternativesData(data);
          // If doctor specifically held a new proposed slot with a token, pre-select it
          if (
            request.proposedTokenNumber &&
            request.proposedStartTime &&
            request.proposedDate &&
            request.proposedStartTime !== request.originalStartTime
          ) {
            setSelectedSlot({
              date: request.proposedDate,
              startTime: request.proposedStartTime,
              endTime: request.proposedEndTime,
              schedulingType: request.proposedSchedulingType,
            });
          }
        }
      } catch {
        // Fallback gracefully if alternatives endpoint has an issue
      } finally {
        if (isMounted) setLoadingAlternatives(false);
      }
    };

    fetchAlternatives();
    return () => {
      isMounted = false;
    };
  }, [isOpen, request]);

  // Load custom date slots when custom date picker is active
  useEffect(() => {
    if (!isOpen || !showCustomDatePicker || !request) return;

    let cancelled = false;
    const fetchSlots = async () => {
      try {
        setLoadingCustomSlots(true);
        const res = await clientAxios.get<{ data: Slot[] }>(
          `/api/doctor/${request.doctorId}/slots-proxy`,
          { params: { date: customDate } },
        );
        if (!cancelled) {
          setCustomSlots(res.data?.data || []);
        }
      } catch {
        if (!cancelled) setCustomSlots([]);
      } finally {
        if (!cancelled) setLoadingCustomSlots(false);
      }
    };

    fetchSlots();
    return () => {
      cancelled = true;
    };
  }, [isOpen, showCustomDatePicker, request, customDate]);

  if (!request) return null;

  const doctorName = request.doctor?.fullName || 'Your Doctor';
  const origDate = formatDate(request.originalDate);
  const origTime = `${formatTime(request.originalStartTime)} – ${formatTime(request.originalEndTime)}`;

  // Confirm selected slot (either prioritized or custom)
  const handleConfirmSelectedSlot = async () => {
    if (!selectedSlot) {
      toast.error('Please select an alternative slot');
      return;
    }

    try {
      setSubmitting(true);
      await elasticSchedulingApi.patientChooseAlternative(request.id, {
        date: selectedSlot.date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });

      toast.success('Appointment Rescheduled Successfully!', {
        description: `Your appointment is confirmed for ${formatDate(selectedSlot.date)} at ${formatTime(selectedSlot.startTime)}.`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to reschedule appointment', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Appointment with Refund
  const handleCancelAppointment = async () => {
    try {
      setSubmitting(true);
      const res = await elasticSchedulingApi.patientCancel(request.id, cancelReason);
      toast.success('Appointment Cancelled', {
        description: res.refund
          ? 'Your appointment has been cancelled and full refund initiated.'
          : 'Your appointment has been cancelled.',
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to cancel appointment', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const sameDay = alternativesData?.alternatives?.sameDay || [];
  const nextDay = alternativesData?.alternatives?.nextDay || [];
  const futureDates = alternativesData?.alternatives?.futureDates || [];
  const totalSlots = (alternativesData?.totalAvailableSlots ?? (sameDay.length + nextDay.length + futureDates.length));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-white border border-slate-200 shadow-2xl rounded-xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-5">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-blue-200 shrink-0" />
            <DialogTitle className="text-base font-bold text-white">
              Appointment Rescheduling Required
            </DialogTitle>
          </div>
          <p className="text-xs text-blue-100 mt-1 leading-relaxed">
            Your appointment with <strong>Dr. {doctorName}</strong> originally booked for{' '}
            <strong>{origDate} at {origTime}</strong> needs to be rescheduled because the doctor has
            updated their clinic availability.
          </p>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!showCustomDatePicker && !showCancelConfirm ? (
            <>
              {/* Original Appointment Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Original Appointment Details
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-700">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {origDate}
                    </span>
                    <span className="flex items-center gap-1 font-mono font-medium text-slate-900">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {origTime}
                    </span>
                  </div>
                  {request.appointmentId && (
                    <Badge variant="outline" className="text-[10px] font-bold py-0 text-blue-700 border-blue-200 bg-blue-50">
                      Token #{request.proposedTokenNumber || '—'}
                    </Badge>
                  )}
                </div>
                {request.doctorReason && (
                  <p className="text-xs text-slate-500 italic pt-1">
                    Doctor note: &ldquo;{request.doctorReason}&rdquo;
                  </p>
                )}
              </div>

              {/* Instructions */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select an Available Alternative Slot
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose a suitable time below to confirm your rescheduled appointment immediately:
                </p>
              </div>

              {/* Loading indicator */}
              {loadingAlternatives ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Finding available slots with Dr. {doctorName}...
                </div>
              ) : totalSlots === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                  <p>No nearby automatic slots found for this doctor.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomDatePicker(true)}
                    className="text-xs"
                  >
                    Browse Other Dates
                  </Button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Priority 1: Same Day */}
                  {sameDay.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                          Priority 1: Same Day ({formatDate(sameDay[0].date)})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sameDay.map((slot, idx) => {
                          const isSelected =
                            selectedSlot?.date === slot.date &&
                            selectedSlot?.startTime === slot.startTime;
                          return (
                            <button
                              key={`same-${idx}`}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/30 shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-blue-300'
                              }`}
                            >
                              <div>
                                <div className="font-mono font-semibold text-slate-900">
                                  {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                                </div>
                                <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                  {slot.availableCapacity} seat(s) available
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Priority 2: Next Day */}
                  {nextDay.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                          Priority 2: Next Day ({formatDate(nextDay[0].date)})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {nextDay.map((slot, idx) => {
                          const isSelected =
                            selectedSlot?.date === slot.date &&
                            selectedSlot?.startTime === slot.startTime;
                          return (
                            <button
                              key={`next-${idx}`}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/30 shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-blue-300'
                              }`}
                            >
                              <div>
                                <div className="font-mono font-semibold text-slate-900">
                                  {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                                </div>
                                <div className="text-[10px] text-blue-700 font-medium mt-0.5">
                                  {slot.availableCapacity} seat(s) available
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Priority 3: Subsequent Days */}
                  {futureDates.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Priority 3: Upcoming Dates
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {futureDates.map((slot, idx) => {
                          const isSelected =
                            selectedSlot?.date === slot.date &&
                            selectedSlot?.startTime === slot.startTime;
                          return (
                            <button
                              key={`future-${idx}`}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/30 shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-blue-300'
                              }`}
                            >
                              <div>
                                <div className="text-[11px] font-semibold text-slate-800">
                                  {formatDate(slot.date)}
                                </div>
                                <div className="font-mono text-slate-600 text-xs mt-0.5">
                                  {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                                </div>
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selection Confirmation Bar */}
              {selectedSlot && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-600 block">Selected Replacement Slot</span>
                    <span className="font-semibold">
                      {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmSelectedSlot}
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        Confirming...
                      </>
                    ) : (
                      'Confirm This Slot'
                    )}
                  </Button>
                </div>
              )}

              {/* Alternative Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomDatePicker(true)}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Browse Custom Date →
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                >
                  Cancel Appointment & Refund
                </Button>
              </div>
            </>
          ) : showCustomDatePicker ? (
            /* Custom Date Picker View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pick a Custom Date
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomDatePicker(false)}
                  className="text-xs text-slate-600"
                >
                  ← Back to Recommendations
                </Button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Date
                </label>
                <Input
                  type="date"
                  min={todayStr}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Available Slots on {formatDate(customDate)}
                </span>

                {loadingCustomSlots ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-600" />
                    Finding available slots...
                  </div>
                ) : customSlots.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No open slots found on this date. Please try another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                    {customSlots
                      .filter(
                        (s) =>
                          (s.status === 'available' || s.status === 'cancel and available for booking') &&
                          !(customDate === request.originalDate && s.startTime === request.originalStartTime),
                      )
                      .map((s, idx) => {
                        const isSelected =
                          selectedSlot?.date === customDate &&
                          selectedSlot?.startTime === s.startTime;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setSelectedSlot({
                                date: customDate,
                                startTime: s.startTime,
                                endTime: s.endTime,
                              })
                            }
                            className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 font-semibold'
                                : 'border-slate-200 bg-white hover:border-blue-300'
                            }`}
                          >
                            <span className="font-mono text-slate-900">
                              {formatTime(s.startTime)} – {formatTime(s.endTime)}
                            </span>
                            <span className="text-[10px] text-emerald-700 mt-1 font-medium">
                              Available
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {selectedSlot && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-600 block">Selected Slot</span>
                    <span className="font-semibold">
                      {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmSelectedSlot}
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4"
                  >
                    Confirm This Slot
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Cancel Appointment View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Cancel Consultation & Refund
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCancelConfirm(false)}
                  className="text-xs text-slate-600"
                >
                  ← Back to Options
                </Button>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                <p className="font-semibold text-rose-950">
                  Are you sure you want to cancel your consultation with Dr. {doctorName}?
                </p>
                <p className="text-rose-800 leading-relaxed">
                  Because this rescheduling was initiated due to doctor schedule changes, you are
                  entitled to a <strong>100% full refund</strong> of consultation fees paid.
                </p>
                <div className="bg-white p-3 rounded-lg border border-rose-200 text-slate-700 text-xs">
                  <span className="font-semibold text-slate-900 block mb-0.5">Refund Processing:</span>
                  Refunds are automatically dispatched through the banking gateway and typically reflect in your account within 5–7 business days.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation (Optional)
                </label>
                <Input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Inconvenient schedule change"
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={submitting}
                  className="text-xs"
                >
                  Keep Appointment
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting}
                  onClick={handleCancelAppointment}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Processing Cancellation...
                    </>
                  ) : (
                    'Confirm Cancellation & Refund'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-slate-500"
          >
            Decide Later
          </Button>
          <span className="text-[11px] text-slate-500 font-mono">
            Hold expires: {formatDateTime(request.expiresAt)}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
