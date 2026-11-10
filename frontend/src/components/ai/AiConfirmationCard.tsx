'use client';

import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

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
  const doctor = typeof data?.doctor === 'string' ? data.doctor : undefined;
  const date = typeof data?.date === 'string' ? data.date : undefined;
  const time = typeof data?.time === 'string' ? data.time : undefined;
  const fee = typeof data?.fee === 'number' || typeof data?.fee === 'string' ? data.fee : undefined;
  const oldDate = typeof data?.oldDate === 'string' ? data.oldDate : undefined;
  const oldTime = typeof data?.oldTime === 'string' ? data.oldTime : undefined;
  const newDate = typeof data?.newDate === 'string' ? data.newDate : undefined;
  const newTime = typeof data?.newTime === 'string' ? data.newTime : undefined;

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-zinc-800 shadow-sm transition-all dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-zinc-200">
      <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-400">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-xs uppercase tracking-wider font-semibold">
          Confirmation Required
        </span>
      </div>

      {data && (
        <div className="mt-2.5 space-y-1 text-sm bg-white/80 dark:bg-zinc-900/60 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40">
          {doctor && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Doctor:</span>
              <span className="font-semibold text-zinc-900 dark:text-white">
                {doctor}
              </span>
            </div>
          )}
          {date && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Date:</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {date}
              </span>
            </div>
          )}
          {time && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Time:</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {time}
              </span>
            </div>
          )}
          {fee !== undefined && (
            <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1">
              <span className="text-zinc-500">Consultation Fee:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Rs. {String(fee)}
              </span>
            </div>
          )}
          {oldDate && newDate && (
            <div className="flex flex-col gap-0.5 border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1 text-xs">
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

      {expiresAt && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Clock className="h-3 w-3" />
          <span>Valid for 5 minutes</span>
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onConfirm(confirmationId)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isLoading ? 'Processing...' : 'Confirm Now'}
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => onCancel(confirmationId)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
