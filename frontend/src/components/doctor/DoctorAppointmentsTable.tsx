'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CheckCircle,
  PlayCircle,
  CheckCheck,
  UserX,
  XCircle,
  Loader2,
  Phone,
  Clock,
  UserCheck,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

interface DoctorAppointmentsTableProps {
  appointments: Appointment[];
  isTodayOnly?: boolean;
}

export function DoctorAppointmentsTable({
  appointments: initialAppointments,
  isTodayOnly = false,
}: DoctorAppointmentsTableProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (
    appointmentId: string,
    action: 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show',
  ) => {
    try {
      setLoadingId(`${appointmentId}-${action}`);

      await clientAxios.post(
        `/api/doctor/appointments/${appointmentId}/action?action=${action}`,
      );

      const actionLabels = {
        'manual-check-in': 'Patient Checked In — Queue updated',
        'start-consultation': 'Consultation Started — Token active',
        complete: 'Consultation Completed',
        'no-show': 'Marked as No Show',
      };

      toast.success(actionLabels[action]);

      // Optimistic update
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id === appointmentId) {
            let nextStatus = a.status;
            if (action === 'manual-check-in') nextStatus = 'CHECKED_IN';
            if (action === 'start-consultation') nextStatus = 'IN_CONSULTATION';
            if (action === 'complete') nextStatus = 'COMPLETED';
            if (action === 'no-show') nextStatus = 'NO_SHOW';
            return { ...a, status: nextStatus };
          }
          return a;
        }),
      );

      router.refresh();
    } catch (err: unknown) {
      toast.error('Action Failed', { description: extractErrorMessage(err) });
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment? The patient will be notified immediately.')) {
      return;
    }

    try {
      setLoadingId(`${appointmentId}-cancel`);
      await clientAxios.patch(`/api/appointment/${appointmentId}/cancel`);

      toast.success('Appointment Cancelled and slot released');
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: 'CANCELLED' } : a)),
      );
      router.refresh();
    } catch (err: unknown) {
      toast.error('Cancel Failed', { description: extractErrorMessage(err) });
    } finally {
      setLoadingId(null);
    }
  };

  if (appointments.length === 0) {
    return (
      <div className="rounded-3xl border border-black/[0.08] bg-white/90 py-16 px-8 text-center space-y-3 backdrop-blur-2xl shadow-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.04] text-zinc-500 mx-auto border border-black/[0.06]">
          <Clock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-zinc-950">
          No Appointments in Queue
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
          No patients are scheduled for this timeframe. New bookings will automatically synchronize here live.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-black/[0.08] bg-white/95 backdrop-blur-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/[0.02] border-b border-black/[0.06] text-zinc-500 uppercase font-bold tracking-wider text-[10px]">
            <tr>
              <th className="py-3.5 px-5">Token / Queue</th>
              <th className="py-3.5 px-5">Slot Time</th>
              {!isTodayOnly && <th className="py-3.5 px-5">Date</th>}
              <th className="py-3.5 px-5">Patient Profile</th>
              <th className="py-3.5 px-5">Contact</th>
              <th className="py-3.5 px-5">Current Status</th>
              <th className="py-3.5 px-5 text-right">Queue Operations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {appointments.map((appt, index) => {
              const patient = appt.patient;
              return (
                <tr
                  key={appt.id}
                  className="hover:bg-black/[0.015] transition-colors"
                >
                  {/* Token & Queue Position */}
                  <td className="py-4 px-5 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="h-9 w-9 rounded-xl bg-black text-white font-mono font-black flex items-center justify-center text-sm shadow-xs">
                        #{String(appt.tokenNumber || index + 1).padStart(2, '0')}
                      </span>
                      {appt.queuePosition && appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                        <span className="text-[11px] font-semibold text-zinc-400">
                          Pos: #{appt.queuePosition}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Slot Time */}
                  <td className="py-4 px-5 whitespace-nowrap font-bold text-zinc-950">
                    {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                  </td>

                  {/* Date if not today only */}
                  {!isTodayOnly && (
                    <td className="py-4 px-5 whitespace-nowrap text-zinc-700 font-semibold">
                      {formatDate(appt.date)}
                    </td>
                  )}

                  {/* Patient Info */}
                  <td className="py-4 px-5 whitespace-nowrap">
                    <div>
                      <span className="font-bold text-zinc-950 block text-sm">
                        {patient?.fullName || 'Patient'}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-medium">
                        {patient?.age ? `${patient.age} yrs` : ''}
                        {patient?.gender ? ` • ${patient.gender}` : ''}
                      </span>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="py-4 px-5 whitespace-nowrap text-zinc-700">
                    {patient?.phone ? (
                      <span className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" />
                        {patient.phone}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-5 whitespace-nowrap">
                    <StatusBadge status={appt.status} />
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {appt.status === 'CONFIRMED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(appt.id, 'manual-check-in')}
                            disabled={loadingId === `${appt.id}-manual-check-in`}
                            className="px-3.5 py-1.5 rounded-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                            title="Check-in patient into clinic queue"
                          >
                            {loadingId === `${appt.id}-manual-check-in` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            <span>Check In</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(appt.id, 'no-show')}
                            disabled={loadingId === `${appt.id}-no-show`}
                            className="p-1.5 rounded-full border border-black/[0.08] hover:bg-black/5 text-zinc-500 text-xs transition-colors cursor-pointer"
                            title="Mark as No Show"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(appt.id)}
                            disabled={loadingId === `${appt.id}-cancel`}
                            className="p-1.5 rounded-full border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs transition-colors cursor-pointer"
                            title="Cancel Appointment"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {appt.status === 'CHECKED_IN' && (
                        <button
                          type="button"
                          onClick={() => handleAction(appt.id, 'start-consultation')}
                          disabled={loadingId === `${appt.id}-start-consultation`}
                          className="btn-primary !py-1.5 !px-4 text-[11px]"
                          title="Call patient into doctor cabin"
                        >
                          {loadingId === `${appt.id}-start-consultation` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <PlayCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Start Consultation</span>
                        </button>
                      )}

                      {appt.status === 'IN_CONSULTATION' && (
                        <button
                          type="button"
                          onClick={() => handleAction(appt.id, 'complete')}
                          disabled={loadingId === `${appt.id}-complete`}
                          className="btn-primary !py-1.5 !px-4 text-[11px]"
                          title="Mark consultation completed"
                        >
                          {loadingId === `${appt.id}-complete` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5" />
                          )}
                          <span>Complete Visit</span>
                        </button>
                      )}

                      {(appt.status === 'COMPLETED' ||
                        appt.status === 'CANCELLED' ||
                        appt.status === 'NO_SHOW' ||
                        appt.status === 'RESCHEDULED') && (
                        <span className="text-[11px] text-zinc-400 font-medium italic">
                          Finished
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
