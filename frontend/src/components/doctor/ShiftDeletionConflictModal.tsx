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
import {
  AlertTriangle,
  Trash2,
  Loader2,
  Calendar,
  Clock,
  CreditCard,
  User,
  ShieldAlert,
} from 'lucide-react';

export interface AffectedShiftAppointment {
  id: string;
  patientName: string;
  date: string;
  startTime: string;
  endTime: string;
  tokenNumber: number | null;
  paymentStatus: string;
  status: string;
}

interface ShiftDeletionConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
  shiftLabel: string;
  shiftType: 'recurring' | 'override';
  conflictCount: number;
  affectedAppointments: AffectedShiftAppointment[];
}

export function ShiftDeletionConflictModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  shiftLabel,
  shiftType,
  conflictCount,
  affectedAppointments,
}: ShiftDeletionConflictModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent className="sm:max-w-xl bg-white border border-slate-200 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header Alert Banner */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white p-5 flex items-start gap-3.5">
          <div className="p-2 bg-rose-500/50 rounded-xl shrink-0 mt-0.5">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-white tracking-tight">
              Active Appointments in this Shift
            </DialogTitle>
            <p className="text-xs text-rose-100 mt-1 leading-relaxed">
              This shift has <strong className="underline underline-offset-2">{conflictCount} confirmed appointment{conflictCount > 1 ? 's' : ''}</strong> booked.
              Deleting this shift will cancel all bookings and issue full refunds.
            </p>
          </div>
        </div>

        {/* Shift Details Context */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
              {shiftType === 'recurring' ? 'Recurring Shift' : 'Special Shift'}:
            </span>
            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              {shiftLabel}
            </span>
          </div>
          <Badge variant="outline" className="text-rose-700 border-rose-200 bg-rose-50 text-[11px] font-bold">
            {conflictCount} Affected
          </Badge>
        </div>

        {/* Warning Policy Box */}
        <div className="p-5 pb-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">Option C Flow — Automatic Cancellation & Refund:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-900/90 text-[11px]">
                <li>All <strong>{conflictCount} confirmed appointment(s)</strong> will be cancelled.</li>
                <li><strong>100% full refund</strong> will be initiated for all paid appointments.</li>
                <li>Patients will be immediately notified via SMS, WhatsApp & email.</li>
                <li>Pending reschedule proposals for these appointments will be invalidated.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Affected Appointments List */}
        <div className="px-5 py-2 overflow-y-auto flex-1 space-y-2.5 max-h-[300px]">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Bookings to be Cancelled ({conflictCount})
          </h4>

          <div className="space-y-2">
            {affectedAppointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{appt.patientName}</span>
                      {appt.tokenNumber && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                          Token #{appt.tokenNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(appt.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {appt.paymentStatus === 'PAID' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-semibold flex items-center gap-1">
                      <CreditCard className="w-2.5 h-2.5 text-emerald-600" />
                      Paid (Full Refund)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-600 border-slate-200 bg-white text-[10px]">
                      {appt.paymentStatus}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold px-4 h-9"
          >
            Keep Shift (Do Not Delete)
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 h-9 flex items-center gap-1.5 shadow-sm shadow-rose-600/30"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cancelling & Refunding...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Cancel Appointments, Refund & Delete Shift</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

