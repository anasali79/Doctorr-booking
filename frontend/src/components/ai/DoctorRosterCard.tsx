'use client';

import React from 'react';
import {
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  ChevronRight,
} from 'lucide-react';

interface RosterItem {
  appointmentId: string;
  tokenNumber: number | null;
  date: string;
  startTime: string;
  endTime: string;
  timeWindow: string;
  status: string;
  patientId: string;
  patientName: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  allergies?: string;
  reasonForVisit?: string | null;
}

interface DoctorRosterCardProps {
  data: {
    date: string;
    total: number;
    counts?: {
      confirmed?: number;
      checkedIn?: number;
      inConsultation?: number;
      completed?: number;
      cancelled?: number;
      noShow?: number;
    };
    roster: RosterItem[];
  };
  onSelectSummary?: (patientName: string, patientId?: string) => void;
}

export function DoctorRosterCard({ data, onSelectSummary }: DoctorRosterCardProps) {
  if (!data || !data.roster) return null;

  const counts = data.counts || {};
  const roster = data.roster || [];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-xs dark:border-blue-900/50 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-3.5 dark:border-blue-900/40 dark:from-blue-950/40 dark:to-indigo-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Today&apos;s Patient Roster
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {data.date} • {data.total} {data.total === 1 ? 'Patient' : 'Patients'} Scheduled
              </p>
            </div>
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
            {counts.confirmed || 0} Confirmed
          </span>
        </div>

        {/* Quick status counters */}
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
          {(counts.checkedIn ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {counts.checkedIn} Checked In
            </span>
          )}
          {(counts.completed ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {counts.completed} Completed
            </span>
          )}
          {(counts.cancelled ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
              <AlertCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              {counts.cancelled} Cancelled
            </span>
          )}
        </div>
      </div>

      {/* Patients Roster List */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {roster.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No appointments scheduled for this date.
          </div>
        ) : (
          roster.map((item, idx) => {
            const tokenStr = item.tokenNumber ? `#${String(item.tokenNumber).padStart(2, '0')}` : `#${idx + 1}`;
            const isConfirmed = item.status === 'CONFIRMED';
            const isCheckedIn = item.status === 'CHECKED_IN';
            const isCompleted = item.status === 'COMPLETED';

            return (
              <div
                key={item.appointmentId || idx}
                className="flex items-center justify-between p-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {/* Token Badge */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-zinc-100 font-mono text-xs font-black text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-normal">Token</span>
                    <span>{tokenStr}</span>
                  </div>

                  {/* Patient Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {item.patientName}
                      </span>
                      {item.age && (
                        <span className="text-[10px] text-zinc-400">
                          ({item.age}y{item.gender ? `, ${item.gender.charAt(0).toUpperCase()}` : ''})
                        </span>
                      )}
                      {item.allergies && item.allergies.toLowerCase() !== 'none' && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          Allergy Alert
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                        <Clock className="h-3 w-3 text-blue-500" />
                        <span>{item.timeWindow}</span>
                      </span>
                      <span>•</span>
                      <span
                        className={`font-semibold ${
                          isCheckedIn
                            ? 'text-amber-600 dark:text-amber-400'
                            : isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {item.reasonForVisit && (
                      <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-xs">
                        Complaint: {item.reasonForVisit}
                      </p>
                    )}
                  </div>
                </div>

                {/* 1-Click Action to View Clinical Summary */}
                <button
                  type="button"
                  onClick={() => onSelectSummary?.(item.patientName, item.patientId)}
                  className="shrink-0 ml-2 inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white active:scale-95 transition-all dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white cursor-pointer"
                >
                  <FileText className="h-3 w-3" />
                  <span>Summary</span>
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

