'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment, AppointmentStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime, formatDate, getTodayIST } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CheckCircle,
  PlayCircle,
  CheckCheck,
  UserX,
  XCircle,
  Phone,
  Clock,
  CalendarDays,
  Calendar,
  Layers,
  Loader2,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DoctorAppointmentsTableProps {
  appointments: Appointment[];
  allAppointments?: Appointment[];
  isTodayOnly?: boolean;
}

export function DoctorAppointmentsTable({
  appointments: initialAppointments,
  allAppointments: initialAllAppointments,
  isTodayOnly = false,
}: DoctorAppointmentsTableProps) {
  const router = useRouter();
  const todayStr = getTodayIST();

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'all'>(
    isTodayOnly ? 'today' : 'all',
  );

  const [todayList, setTodayList] = useState<Appointment[]>(initialAppointments || []);
  const [allList, setAllList] = useState<Appointment[]>(
    initialAllAppointments || initialAppointments || [],
  );

  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Compute upcoming (today or future dates, not cancelled)
  const upcomingList = allList.filter(
    (a) => a.date >= todayStr && a.status !== 'CANCELLED',
  );

  const displayedList =
    activeTab === 'today'
      ? todayList
      : activeTab === 'upcoming'
      ? upcomingList
      : allList;

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

      const updater = (prev: Appointment[]): Appointment[] =>
        prev.map((a): Appointment => {
          if (a.id === appointmentId) {
            let nextStatus: AppointmentStatus = a.status;
            if (action === 'manual-check-in') nextStatus = 'CHECKED_IN';
            if (action === 'start-consultation') nextStatus = 'IN_CONSULTATION';
            if (action === 'complete') nextStatus = 'COMPLETED';
            if (action === 'no-show') nextStatus = 'NO_SHOW';
            return { ...a, status: nextStatus };
          }
          return a;
        });

      setTodayList(updater);
      setAllList(updater);

      router.refresh();
    } catch (err: unknown) {
      toast.error('Action Failed', { description: extractErrorMessage(err) });
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (
      !confirm(
        'Are you sure you want to cancel this appointment? The patient will be notified immediately.',
      )
    ) {
      return;
    }

    try {
      setLoadingId(`${appointmentId}-cancel`);
      await clientAxios.patch(`/api/appointment/${appointmentId}/cancel`);

      toast.success('Appointment Cancelled and slot released');
      const updater = (prev: Appointment[]): Appointment[] =>
        prev.map((a): Appointment =>
          a.id === appointmentId ? { ...a, status: 'CANCELLED' as AppointmentStatus } : a,
        );

      setTodayList(updater);
      setAllList(updater);

      router.refresh();
    } catch (err: unknown) {
      toast.error('Cancel Failed', { description: extractErrorMessage(err) });
    } finally {
      setLoadingId(null);
    }
  };

  const showDateColumn = activeTab !== 'today' || !isTodayOnly;

  return (
    <div className="space-y-4">
      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('today')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all h-auto ${
            activeTab === 'today'
              ? 'bg-[#0066cc] text-white shadow-xs hover:bg-[#0055b3] hover:text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Today&apos;s Queue ({todayList.length})</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all h-auto ${
            activeTab === 'upcoming'
              ? 'bg-[#0066cc] text-white shadow-xs hover:bg-[#0055b3] hover:text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Upcoming Bookings ({upcomingList.length})</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all h-auto ${
            activeTab === 'all'
              ? 'bg-[#0066cc] text-white shadow-xs hover:bg-[#0055b3] hover:text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Appointments ({allList.length})</span>
        </Button>
      </div>

      {displayedList.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200/90 bg-white py-14 px-8 text-center space-y-3 shadow-2xs">
          <CardContent className="p-0 flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0066cc] mx-auto border border-blue-100">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-3">
              {activeTab === 'today'
                ? 'No Appointments in Today’s Queue'
                : activeTab === 'upcoming'
                ? 'No Upcoming Appointments'
                : 'No Appointments Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mt-1">
              {activeTab === 'today' && allList.length > 0
                ? `You currently have ${allList.length} appointment(s) in other categories. Tap "Upcoming Bookings" or "All Appointments" above to view them.`
                : 'New patient appointments will automatically synchronize here live.'}
            </p>
            {activeTab === 'today' && allList.length > 0 && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveTab('all')}
                  className="btn-secondary !text-xs !py-1.5 !px-3 h-auto"
                >
                  View All Appointments ({allList.length}) →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden p-0">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
              <TableRow>
                <TableHead className="py-3 px-4">Token</TableHead>
                <TableHead className="py-3 px-4">Slot Time</TableHead>
                {showDateColumn && <TableHead className="py-3 px-4">Date</TableHead>}
                <TableHead className="py-3 px-4">Patient Profile</TableHead>
                <TableHead className="py-3 px-4">Contact</TableHead>
                <TableHead className="py-3 px-4">Current Status</TableHead>
                <TableHead className="py-3 px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {displayedList.map((appt, index) => {
                const patient = appt.patient;
                const isTodayAppt = appt.date === todayStr;

                return (
                  <TableRow
                    key={appt.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Token */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-xl bg-slate-900 text-white font-mono font-black flex items-center justify-center text-xs shadow-2xs">
                          #{String(appt.tokenNumber || index + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </TableCell>

                    {/* Slot Time */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-900">
                      {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                    </TableCell>

                    {/* Date */}
                    {showDateColumn && (
                      <TableCell className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                        {isTodayAppt ? (
                          <span className="inline-flex items-center gap-1 text-[#0066cc] font-bold">
                            Today ({formatDate(appt.date)})
                          </span>
                        ) : (
                          formatDate(appt.date)
                        )}
                      </TableCell>
                    )}

                    {/* Patient Info */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <div>
                        <span className="font-bold text-slate-900 block text-xs">
                          {patient?.fullName || 'Patient'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {patient?.age ? `${patient.age} yrs` : ''}
                          {patient?.gender ? ` • ${patient.gender}` : ''}
                        </span>
                      </div>
                    </TableCell>

                    {/* Contact */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                      {patient?.phone ? (
                        <span className="flex items-center gap-1 font-mono text-xs font-semibold">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {patient.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={appt.status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {appt.status === 'CONFIRMED' && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                handleAction(appt.id, 'manual-check-in')
                              }
                              disabled={
                                loadingId === `${appt.id}-manual-check-in`
                              }
                              className="px-3 py-1 rounded-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs h-auto"
                              title="Check-in patient into clinic queue"
                            >
                              {loadingId ===
                              `${appt.id}-manual-check-in` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              <span>Check In</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              onClick={() => handleAction(appt.id, 'no-show')}
                              disabled={loadingId === `${appt.id}-no-show`}
                              className="p-1.5 rounded-full border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs transition-colors cursor-pointer"
                              title="Mark as No Show"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              onClick={() => handleCancel(appt.id)}
                              disabled={loadingId === `${appt.id}-cancel`}
                              className="p-1.5 rounded-full border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs transition-colors cursor-pointer"
                              title="Cancel Appointment"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}

                        {appt.status === 'CHECKED_IN' && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              handleAction(appt.id, 'start-consultation')
                            }
                            disabled={
                              loadingId === `${appt.id}-start-consultation`
                            }
                            className="btn-primary !py-1 !px-3 text-[11px] h-auto"
                            title="Call patient into doctor cabin"
                          >
                            {loadingId ===
                            `${appt.id}-start-consultation` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PlayCircle className="w-3 h-3" />
                            )}
                            <span>Start Consultation</span>
                          </Button>
                        )}

                        {appt.status === 'IN_CONSULTATION' && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleAction(appt.id, 'complete')}
                            disabled={loadingId === `${appt.id}-complete`}
                            className="btn-primary !py-1 !px-3 text-[11px] h-auto"
                            title="Mark consultation completed"
                          >
                            {loadingId === `${appt.id}-complete` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCheck className="w-3 h-3" />
                            )}
                            <span>Complete Visit</span>
                          </Button>
                        )}

                        {(appt.status === 'COMPLETED' ||
                          appt.status === 'CANCELLED' ||
                          appt.status === 'NO_SHOW' ||
                          appt.status === 'RESCHEDULED') && (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            Finished
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
