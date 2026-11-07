'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTime, formatDate } from '@/lib/utils';
import { ConflictCheckResult, AffectedAppointment } from '@/lib/api/elastic-scheduling';
import {
  AlertTriangle,
  Sparkles,
  UserCheck,
  Calendar,
  Clock,
  Layers,
  CreditCard,
  Phone,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface ScheduleConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictData: ConflictCheckResult | null;
  shiftData: any;
  onSelectSmartReschedule: (affectedIds: string[]) => void;
  onSelectManualReschedule: (affectedAppointment: AffectedAppointment) => void;
}

export function ScheduleConflictModal({
  isOpen,
  onClose,
  conflictData,
  shiftData,
  onSelectSmartReschedule,
  onSelectManualReschedule,
}: ScheduleConflictModalProps) {
  if (!conflictData || !conflictData.hasConflicts) return null;

  const count = conflictData.conflictCount;
  const appts = conflictData.affectedAppointments;

  const handleStartSmartReschedule = () => {
    const ids = appts.map((a) => a.appointmentId);
    onSelectSmartReschedule(ids);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white border border-slate-200 shadow-2xl rounded-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header Alert */}
        <div className="bg-amber-500 text-white p-5 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5 text-amber-100" />
          <div>
            <DialogTitle className="text-lg font-bold text-white">
              Schedule Conflict Detected!
            </DialogTitle>
            <p className="text-xs text-amber-100 mt-1">
              Your updated availability affects{' '}
              <strong className="underline underline-offset-2">
                {count} existing booked appointment{count > 1 ? 's' : ''}
              </strong>
              . Existing confirmed appointments will <strong>never</strong> be automatically
              cancelled or deleted.
            </p>
          </div>
        </div>

        {/* Shift Context Notice */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <div>
            <span className="font-semibold text-slate-800">Clipped Period: </span>
            {conflictData.clippedIntervals?.map((c, i) => (
              <span key={i} className="font-mono font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 ml-1">
                {formatTime(c.start)} – {formatTime(c.end)}
              </span>
            ))}
          </div>
          <span className="text-slate-500 font-mono">
            Target New Hours: {formatTime(shiftData?.newStartTime)} – {formatTime(shiftData?.newEndTime)}
          </span>
        </div>

        {/* Affected Appointments List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Affected Confirmed Appointments ({count})
            </h4>
            <span className="text-[11px] text-slate-400">
              Select resolution method below
            </span>
          </div>

          <div className="space-y-2">
            {appts.map((app) => (
              <div
                key={app.appointmentId}
                className="border border-slate-200 rounded-lg p-3 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-3 shadow-xs"
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
                    {app.tokenNumber && (
                      <Badge variant="outline" className="text-[10px] font-bold py-0 text-blue-700 border-blue-200 bg-blue-50">
                        Token #{app.tokenNumber}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(app.date)}
                    </span>
                    <span className="flex items-center gap-1 font-mono font-medium text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
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
        </div>

        {/* Resolution Options Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-slate-900 order-2 sm:order-1"
          >
            Cancel Availability Change
          </Button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end order-1 sm:order-2">
            <Button
              type="button"
              onClick={handleStartSmartReschedule}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              Smart Rescheduling ({count})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

