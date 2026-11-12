'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Calendar,
  Users,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface AiConfirmationCardProps {
  confirmationId: string;
  expiresAt?: string | null;
  data?: Record<string, unknown>;
  onConfirm: (confirmationId: string) => void;
  onCancel: (confirmationId: string) => void;
  isLoading?: boolean;
}

export function AiConfirmationCard({
  confirmationId,
  expiresAt,
  data,
  onConfirm,
  onCancel,
  isLoading,
}: AiConfirmationCardProps) {
  const actionType = typeof data?.actionType === 'string' ? data.actionType : undefined;

  // Patient Booking Fields
  const doctor = typeof data?.doctor === 'string' ? data.doctor : undefined;
  const date = typeof data?.date === 'string' ? data.date : undefined;
  const time = typeof data?.time === 'string' ? data.time : undefined;
  const fee =
    typeof data?.fee === 'number' || typeof data?.fee === 'string'
      ? data.fee
      : undefined;
  const oldDate = typeof data?.oldDate === 'string' ? data.oldDate : undefined;
  const oldTime = typeof data?.oldTime === 'string' ? data.oldTime : undefined;
  const newDate = typeof data?.newDate === 'string' ? data.newDate : undefined;
  const newTime = typeof data?.newTime === 'string' ? data.newTime : undefined;

  // Doctor Availability Fields
  const day = typeof data?.day === 'string' ? data.day : undefined;
  const startTime = typeof data?.startTime === 'string' ? data.startTime : undefined;
  const endTime = typeof data?.endTime === 'string' ? data.endTime : undefined;
  const slotDuration = typeof data?.slotDuration === 'number' ? data.slotDuration : undefined;
  const totalEstimatedSlots =
    typeof data?.totalEstimatedSlots === 'number' ? data.totalEstimatedSlots : undefined;
  const shiftType = typeof data?.shiftType === 'string' ? data.shiftType : undefined;

  // Doctor Elastic Shrink / Expand Fields
  const conflictCount = typeof data?.conflictCount === 'number' ? data.conflictCount : 0;
  const affectedAppointments = Array.isArray(data?.affectedAppointments)
    ? (data.affectedAppointments as Array<{
        appointmentId: string;
        patientName: string;
        tokenNumber?: number;
        startTime: string;
        endTime: string;
      }>)
    : [];

  const isAvailabilitySet = actionType === 'SET_DOCTOR_AVAILABILITY';
  const isShrink = actionType === 'APPLY_DOCTOR_SHRINK';
  const isExpand = actionType === 'APPLY_DOCTOR_EXPAND';

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-zinc-800 shadow-sm transition-all dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-zinc-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-400">
          {isShrink && conflictCount > 0 ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          )}
          <span className="text-xs uppercase tracking-wider font-bold">
            {isAvailabilitySet
              ? 'Confirm Availability Schedule'
              : isShrink
              ? 'Confirm Shift Shrink'
              : isExpand
              ? 'Confirm Shift Expansion'
              : 'Confirmation Required'}
          </span>
        </div>

        {expiresAt && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700/80 dark:text-amber-300/80">
            <Clock className="h-3 w-3" />
            <span>5m valid</span>
          </div>
        )}
      </div>

      {/* 1. DOCTOR AVAILABILITY CONFIRMATION CARD */}
      {isAvailabilitySet && (
        <div className="mt-2.5 space-y-2 bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40 text-xs">
          <div className="flex justify-between items-center pb-1.5 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-500 font-medium">Shift Type:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {shiftType === 'RECURRING' ? 'Recurring Weekly' : 'Specific Date'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Day / Date:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{day}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Shift Hours:</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {startTime} - {endTime}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Slot Duration:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {slotDuration} mins / patient
            </span>
          </div>

          {totalEstimatedSlots !== undefined && (
            <div className="flex justify-between items-center pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500 font-medium">Total Slots Created:</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400">
                ~{totalEstimatedSlots} slots
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2. DOCTOR ELASTIC SHRINK CONFIRMATION CARD */}
      {isShrink && (
        <div className="mt-2.5 space-y-2.5 bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">New Shift Hours:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {startTime} - {endTime}
            </span>
          </div>

          {conflictCount > 0 ? (
            <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>{conflictCount} Existing Appointment(s) Affected</span>
              </div>
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300/90 leading-tight">
                In appointments ka time shrunken shift ke bahar hai.
              </p>

              {/* List of affected patients */}
              <div className="mt-2 space-y-1">
                {affectedAppointments.slice(0, 4).map((a, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-[11px] bg-white/70 dark:bg-zinc-800/80 px-2 py-1 rounded border border-amber-100 dark:border-zinc-700"
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {a.patientName} {a.tokenNumber ? `(Token #${a.tokenNumber})` : ''}
                    </span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {a.startTime}
                    </span>
                  </div>
                ))}
                {affectedAppointments.length > 4 && (
                  <div className="text-[10px] text-zinc-500 text-center">
                    +{affectedAppointments.length - 4} more patients
                  </div>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-amber-200/80 dark:border-amber-900/60 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                ✓ Confirm karne par system in sabhi patients ko automatically reschedule request aur notifications bhej dega.
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 text-[11px] font-medium">
              ✓ Koi appointment conflict nahi hai. Shift safely shrink ho jayegi.
            </div>
          )}
        </div>
      )}

      {/* 3. DOCTOR ELASTIC EXPAND CONFIRMATION CARD */}
      {isExpand && (
        <div className="mt-2.5 space-y-2 bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-medium">Expanded Shift Hours:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {startTime} - {endTime}
            </span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            ✓ Shift badhane se extra booking slots open ho jayenge.
          </p>
        </div>
      )}

      {/* 4. STANDARD PATIENT BOOKING / RESCHEDULE CARD */}
      {!isAvailabilitySet && !isShrink && !isExpand && data && (
        <div className="mt-2.5 space-y-1.5 text-xs bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40">
          {doctor && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Doctor:</span>
              <span className="font-bold text-zinc-900 dark:text-white">Dr. {doctor}</span>
            </div>
          )}
          {date && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Date:</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{date}</span>
            </div>
          )}
          {time && (
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 font-medium">Time:</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{time}</span>
            </div>
          )}
          {fee !== undefined && (
            <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1">
              <span className="text-zinc-500 font-medium">Consultation Fee:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Rs. {String(fee)}
              </span>
            </div>
          )}
          {oldDate && newDate && (
            <div className="flex flex-col gap-0.5 border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1 text-[11px]">
              <div className="text-zinc-500 line-through">
                Old: {oldDate} at {oldTime}
              </div>
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                New: {newDate} at {newTime}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION ACTION BUTTONS */}
      <div className="mt-3.5 flex items-center gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onConfirm(confirmationId)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0066cc] px-3.5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#0052a3] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isLoading
            ? 'Processing...'
            : isAvailabilitySet
            ? 'Confirm & Save Availability'
            : isShrink
            ? conflictCount > 0
              ? 'Confirm Shrink & Auto-Reschedule'
              : 'Confirm Shrink'
            : isExpand
            ? 'Confirm Expand Shift'
            : 'Confirm Now'}
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => onCancel(confirmationId)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
