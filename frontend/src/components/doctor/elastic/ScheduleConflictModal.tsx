'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatTime, formatDate } from '@/lib/utils';
import { extractErrorMessage } from '@/lib/api/axios';
import {
  elasticSchedulingApi,
  ConflictCheckResult,
  AffectedAppointment,
  PreservedAppointment,
} from '@/lib/api/elastic-scheduling';
import {
  Sparkles,
  Calendar,
  Clock,
  Layers,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Users,
} from 'lucide-react';

interface ScheduleConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictData: ConflictCheckResult | null;
  shiftData: any;
  onSelectSmartReschedule: (affectedIds: string[]) => void;
  onSelectManualReschedule: (affectedAppointment: AffectedAppointment) => void;
  onSuccess?: () => void;
}

export function ScheduleConflictModal({
  isOpen,
  onClose,
  conflictData,
  shiftData,
  onSelectSmartReschedule,
  onSelectManualReschedule,
  onSuccess,
}: ScheduleConflictModalProps) {
  const [activeTab, setActiveTab] = useState<'affected' | 'preserved'>('affected');
  const [applying, setApplying] = useState<boolean>(false);

  if (!conflictData || !conflictData.hasConflicts) return null;

  const count = conflictData.conflictCount;
  const appts = conflictData.affectedAppointments || [];
  const preservedAppts = conflictData.preservedAppointments || [];
  const summary = conflictData.summary;

  const preservedCount = summary?.preservedCount ?? preservedAppts.length;
  const affectedCount = summary?.affectedCount ?? count;

  const handleStartSmartReschedule = () => {
    const ids = appts.map((a) => a.appointmentId);
    onSelectSmartReschedule(ids);
  };

  const handleConfirmShrink = async () => {
    try {
      setApplying(true);
      await elasticSchedulingApi.applyShrink({
        shiftType: shiftData.shiftType,
        shiftId: shiftData.id,
        newStartTime: shiftData.newStartTime,
        newEndTime: shiftData.newEndTime,
        newMaxPatients: shiftData.newMaxPatients,
        newSlotDuration: shiftData.newSlotDuration,
        forceIfNoConflicts: true,
      });

      toast.success('Schedule Updated Successfully', {
        description: `${preservedCount} booking(s) preserved. ${affectedCount} affected patient(s) notified to choose alternative slots.`,
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      toast.error('Failed to update schedule', {
        description: extractErrorMessage(err),
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white border border-slate-200 shadow-2xl rounded-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header Alert */}
        <div className="bg-amber-500 text-white p-5 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-100" />
          <div>
            <DialogTitle className="text-lg font-bold text-white">
              Schedule Shrink Preview (Token-Based Patient Allocation)
            </DialogTitle>
            <p className="text-xs text-amber-100 mt-1 leading-relaxed">
              Modifying availability retains patients based on their original <strong>FIFO token order</strong>.
              Preserved patients remain confirmed; patients beyond revised capacity will be notified to select an alternative slot.
            </p>
          </div>
        </div>

        {/* Schedule Change Comparison Banner */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Original Schedule</span>
              <span className="font-semibold text-slate-800">
                {summary?.oldSchedule || `${formatTime(shiftData?.startTime)} – ${formatTime(shiftData?.endTime)}`}
              </span>
              <span className="text-[11px] text-slate-500 ml-1">
                (Cap: {summary?.oldCapacity ?? shiftData?.maxPatients ?? '—'})
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />

            <div className="bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-blue-600 block">Revised Schedule</span>
              <span className="font-semibold text-blue-900">
                {summary?.newSchedule || `${formatTime(shiftData?.newStartTime)} – ${formatTime(shiftData?.newEndTime)}`}
              </span>
              <span className="text-[11px] text-blue-700 ml-1">
                (Cap: {summary?.newCapacity ?? conflictData.revisedCapacity ?? '—'})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {preservedCount} Preserved
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              {affectedCount} Reschedule
            </span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('affected')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'affected'
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Affected Appointments ({affectedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preserved')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'preserved'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Preserved Appointments ({preservedCount})
          </button>
        </div>

        {/* Appointments List Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'affected' ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-2">
                These patients exceed the revised capacity or fall in clipped hours. They will receive automated notifications with prioritized alternative slots to choose from.
              </p>
              {appts.map((app) => (
                <div
                  key={app.appointmentId}
                  className="border border-amber-200 rounded-lg p-3 bg-amber-50/40 hover:border-amber-300 transition-colors flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {app.patientName}
                      </span>
                      {app.patientPhone && (
                        <span className="text-xs text-slate-500 font-mono">
                          ({app.patientPhone})
                        </span>
                      )}
                      {app.tokenNumber !== null && app.tokenNumber !== undefined && (
                        <Badge variant="outline" className="text-[10px] font-bold py-0 text-amber-800 border-amber-300 bg-amber-100">
                          Token #{app.tokenNumber}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-semibold py-0 text-rose-700 border-rose-200 bg-rose-50">
                        Requires Rescheduling
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(app.date)}
                      </span>
                      <span className="flex items-center gap-1 font-mono font-medium text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        {formatTime(app.startTime)} – {formatTime(app.endTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-semibold uppercase text-slate-600">
                          {app.schedulingType}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span
                          className={`text-[11px] font-bold ${
                            app.paymentStatus === 'PAID'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {app.paymentStatus}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Individual Manual Reschedule Action */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectManualReschedule(app)}
                    className="text-xs shrink-0 border-slate-300 hover:bg-slate-100 text-slate-700"
                  >
                    Reschedule Manually
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-2">
                These patients are preserved based on token order. Their original token numbers and confirmed appointments remain intact.
              </p>
              {preservedAppts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No appointments accommodated in revised capacity.
                </div>
              ) : (
                preservedAppts.map((app) => (
                  <div
                    key={app.appointmentId}
                    className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40 transition-colors flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">
                          {app.patientName}
                        </span>
                        {app.patientPhone && (
                          <span className="text-xs text-slate-500 font-mono">
                            ({app.patientPhone})
                          </span>
                        )}
                        {app.tokenNumber !== null && app.tokenNumber !== undefined && (
                          <Badge variant="outline" className="text-[10px] font-bold py-0 text-emerald-800 border-emerald-300 bg-emerald-100">
                            Token #{app.tokenNumber}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] font-semibold py-0 text-emerald-700 border-emerald-200 bg-emerald-50">
                          Preserved & Confirmed
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(app.date)}
                        </span>
                        <span className="flex items-center gap-1 font-mono font-medium text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          {formatTime(app.startTime)} – {formatTime(app.endTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] font-semibold uppercase text-slate-600">
                            {app.schedulingType}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Resolution Options Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={applying}
            className="text-xs text-slate-600 hover:text-slate-900 order-2 sm:order-1"
          >
            Cancel Availability Change
          </Button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleStartSmartReschedule}
              disabled={applying}
              className="text-xs border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Smart Reschedule Review
            </Button>

            <Button
              type="button"
              onClick={handleConfirmShrink}
              disabled={applying}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 flex items-center gap-1.5 shadow-sm"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Applying Schedule Change...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-blue-200" />
                  Confirm & Send Alternatives ({affectedCount})
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
