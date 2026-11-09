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
  RescheduleRequestRecord,
} from '@/lib/api/elastic-scheduling';
import { Slot } from '@/types';
import {
  AlertCircle,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  User,
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
  const [showAlternativePicker, setShowAlternativePicker] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  // Alternative picker state
  const todayStr = getTodayIST();
  const [altDate, setAltDate] = useState<string>(todayStr);
  const [altSlots, setAltSlots] = useState<Slot[]>([]);
  const [loadingAltSlots, setLoadingAltSlots] = useState<boolean>(false);
  const [selectedAltSlot, setSelectedAltSlot] = useState<Slot | null>(null);

  // Cancellation state
  const [cancelReason, setCancelReason] = useState<string>('Cannot make proposed reschedule time');

  useEffect(() => {
    if (request) {
      setAltDate(request.proposedDate >= todayStr ? request.proposedDate : todayStr);
      setShowAlternativePicker(false);
      setShowCancelConfirm(false);
      setSelectedAltSlot(null);
    }
  }, [request, todayStr]);

  // Load alternative slots when alternative picker is opened or date changes
  useEffect(() => {
    if (!isOpen || !showAlternativePicker || !request) return;

    let cancelled = false;
    const fetchSlots = async () => {
      try {
        setLoadingAltSlots(true);
        setSelectedAltSlot(null);
        const res = await clientAxios.get<{ data: Slot[] }>(
          `/api/doctor/${request.doctorId}/slots-proxy`,
          { params: { date: altDate } },
        );
        if (!cancelled) {
          setAltSlots(res.data?.data || []);
        }
      } catch {
        if (!cancelled) setAltSlots([]);
      } finally {
        if (!cancelled) setLoadingAltSlots(false);
      }
    };

    fetchSlots();
    return () => {
      cancelled = true;
    };
  }, [isOpen, showAlternativePicker, request, altDate]);

  if (!request) return null;

  const doctorName = request.doctor?.fullName || 'Your Doctor';
  const origDate = formatDate(request.originalDate);
  const origTime = formatTime(request.originalStartTime);
  const propDate = formatDate(request.proposedDate);
  const propTime = `${formatTime(request.proposedStartTime)} – ${formatTime(request.proposedEndTime)}`;

  // Action 1: Confirm Appointment
  const handleConfirmProposed = async () => {
    try {
      setSubmitting(true);
      await elasticSchedulingApi.patientAccept(request.id);
      toast.success('Appointment Confirmed!', {
        description: `Your appointment with Dr. ${doctorName} is confirmed for ${propDate} at ${formatTime(request.proposedStartTime)}.`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to confirm proposed appointment', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Action 2: Choose Another Slot
  const handleConfirmAlternative = async () => {
    if (!selectedAltSlot) {
      toast.error('Please select an available slot');
      return;
    }

    try {
      setSubmitting(true);
      await elasticSchedulingApi.patientChooseAlternative(request.id, {
        date: altDate,
        startTime: selectedAltSlot.startTime,
        endTime: selectedAltSlot.endTime,
      });

      toast.success('Alternative Slot Confirmed!', {
        description: `Appointment rescheduled to ${formatDate(altDate)} at ${formatTime(selectedAltSlot.startTime)}.`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to select alternative slot', {
        description: extractErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Action 3: Cancel Appointment with Refund
  const handleCancelAppointment = async () => {
    try {
      setSubmitting(true);
      const res = await elasticSchedulingApi.patientCancel(request.id, cancelReason);
      toast.success('Appointment Cancelled', {
        description: res.refund
          ? 'Your appointment has been cancelled and refund initiated.'
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl bg-white border border-slate-200 shadow-2xl rounded-xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-5">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-blue-200 shrink-0" />
            <DialogTitle className="text-base font-bold text-white">
              Appointment Rescheduling Request
            </DialogTitle>
          </div>
          <p className="text-xs text-blue-100 mt-1 leading-relaxed">
            Your appointment with <strong>Dr. {doctorName}</strong>, originally scheduled for{' '}
            <strong>{origDate} at {origTime}</strong>, needs to be rescheduled because the doctor has
            updated their clinic availability.
          </p>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!showAlternativePicker && !showCancelConfirm ? (
            <>
              {/* Proposal Comparison Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Proposed Replacement Time
                </span>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                  <div>
                    <div className="text-xs text-slate-400 line-through font-mono">
                      Original: {origDate} at {origTime}
                    </div>
                    <div className="text-base font-bold text-blue-700 font-mono mt-0.5 flex items-center gap-2">
                      <span>{propDate}</span>
                      <span>•</span>
                      <span>{propTime}</span>
                    </div>
                    {request.proposedTokenNumber && (
                      <span className="text-xs text-slate-600 font-medium">
                        Token Number: #{request.proposedTokenNumber}
                      </span>
                    )}
                  </div>

                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold text-xs shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Slot Temporarily Reserved
                  </Badge>
                </div>

                {request.doctorReason && (
                  <p className="text-xs text-slate-500 italic">
                    Doctor note: &ldquo;{request.doctorReason}&rdquo;
                  </p>
                )}
              </div>

              {/* 3 Main Action Choices */}
              <div className="space-y-2.5 pt-2">
                <p className="text-xs font-semibold text-slate-700">
                  Please choose how you would like to proceed:
                </p>

                {/* Option 1: Confirm */}
                <button
                  type="button"
                  onClick={handleConfirmProposed}
                  disabled={submitting}
                  className="w-full p-3.5 rounded-xl border-2 border-blue-500 bg-blue-50/60 hover:bg-blue-100/70 transition-all text-left flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-blue-900 block group-hover:text-blue-950">
                      1. Confirm Proposed Appointment
                    </span>
                    <span className="text-xs text-blue-700 block">
                      Accept {propDate} at {formatTime(request.proposedStartTime)}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Option 2: Choose Another Slot */}
                <button
                  type="button"
                  onClick={() => setShowAlternativePicker(true)}
                  disabled={submitting}
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-slate-900 block">
                      2. Choose Another Available Slot
                    </span>
                    <span className="text-xs text-slate-500 block">
                      Browse open dates and times that better suit your schedule
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* Option 3: Cancel Appointment */}
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={submitting}
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 transition-all text-left flex items-center justify-between text-rose-800"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-rose-900 block">
                      3. Cancel Appointment & Refund
                    </span>
                    <span className="text-xs text-rose-600 block">
                      Cancel booking with full refund to original payment method
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            </>
          ) : showAlternativePicker ? (
            /* Alternative Slot Picker View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Browse Alternative Openings
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlternativePicker(false)}
                  className="text-xs text-slate-600"
                >
                  ← Back to Proposal
                </Button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Date
                </label>
                <Input
                  type="date"
                  min={todayStr}
                  value={altDate}
                  onChange={(e) => setAltDate(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Available Slots on {formatDate(altDate)}
                </span>

                {loadingAltSlots ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-600" />
                    Finding available slots...
                  </div>
                ) : altSlots.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No open slots found on this date. Please try another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                    {altSlots
                      .filter(
                        (s) =>
                          (s.status === 'available' || s.status === 'cancel and available for booking') &&
                          !(altDate === request.originalDate && s.startTime === request.originalStartTime),
                      )
                      .map((s, idx) => {
                        const isSelected =
                          selectedAltSlot?.startTime === s.startTime &&
                          selectedAltSlot?.endTime === s.endTime;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedAltSlot(s)}
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

              {selectedAltSlot && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-mono">
                  Selected: {formatDate(altDate)} at {formatTime(selectedAltSlot.startTime)} – {formatTime(selectedAltSlot.endTime)}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAlternativePicker(false)}
                  disabled={submitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting || !selectedAltSlot}
                  onClick={handleConfirmAlternative}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Confirming...
                    </>
                  ) : (
                    'Confirm Selected Opening'
                  )}
                </Button>
              </div>
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
          <span className="text-[11px] text-slate-400 font-mono">
            Hold expires: {formatDate(request.expiresAt)}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

