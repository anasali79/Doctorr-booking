'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment, Slot } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatTime, getTodayIST } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CalendarDays,
  XCircle,
  RefreshCw,
  Loader2,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { PatientLiveQueueModal } from './PatientLiveQueueModal';

interface PatientAppointmentsClientProps {
  initialAppointments: Appointment[];
}

export function PatientAppointmentsClient({
  initialAppointments,
}: PatientAppointmentsClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST' | 'CANCELLED'>('UPCOMING');

  // Cancel dialog state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Reschedule dialog state
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(getTodayIST());
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Live queue modal state
  const [liveQueueApptId, setLiveQueueApptId] = useState<string | null>(null);

  const todayStr = getTodayIST();

  const upcomingList = appointments.filter(
    (a) =>
      a.status === 'CONFIRMED' ||
      a.status === 'CHECKED_IN' ||
      a.status === 'IN_CONSULTATION',
  );

  const pastList = appointments.filter(
    (a) => a.status === 'COMPLETED' || a.status === 'NO_SHOW',
  );

  const cancelledList = appointments.filter(
    (a) => a.status === 'CANCELLED' || a.status === 'RESCHEDULED',
  );

  const currentList =
    activeTab === 'UPCOMING'
      ? upcomingList
      : activeTab === 'PAST'
      ? pastList
      : cancelledList;

  // Handle Cancel via Axios
  const handleCancel = async () => {
    if (!cancellingId) return;

    try {
      setCancelLoading(true);
      await clientAxios.patch(`/api/appointment/${cancellingId}/cancel`);

      toast.success('Appointment Cancelled', {
        description: 'The consultation slot has been released back to the clinic.',
      });

      setAppointments((prev) =>
        prev.map((a) => (a.id === cancellingId ? { ...a, status: 'CANCELLED' } : a)),
      );
      setCancellingId(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error('Cancel Failed', { description: extractErrorMessage(err) });
    } finally {
      setCancelLoading(false);
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = (appt: Appointment) => {
    setReschedulingAppt(appt);
    setSelectedSlot(null);
    setRescheduleDate(appt.date);
    fetchRescheduleSlots(appt.doctorId, appt.date);
  };

  const fetchRescheduleSlots = async (doctorId: string, date: string) => {
    try {
      setLoadingSlots(true);
      const res = await clientAxios.get<{
        message?: string;
        data: Slot[];
      }>(`/api/doctor/${doctorId}/slots-proxy`, {
        params: { date },
      });
      setRescheduleSlots(res.data.data || []);
    } catch (err: unknown) {
      toast.error('Failed to load slots', { description: extractErrorMessage(err) });
      setRescheduleSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!reschedulingAppt || !selectedSlot) return;

    try {
      setRescheduleLoading(true);
      await clientAxios.patch(`/api/appointment/${reschedulingAppt.id}/reschedule`, {
        date: rescheduleDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });

      toast.success('Appointment Rescheduled!', {
        description: `Moved to ${formatDate(rescheduleDate)} at ${formatTime(selectedSlot.startTime)}`,
      });

      setReschedulingAppt(null);
      router.refresh();
      window.location.reload();
    } catch (err: unknown) {
      toast.error('Reschedule Conflict', { description: extractErrorMessage(err) });
    } finally {
      setRescheduleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('UPCOMING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'UPCOMING'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Upcoming Visits ({upcomingList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PAST')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PAST'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Consultation History ({pastList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CANCELLED')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'CANCELLED'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Cancelled ({cancelledList.length})
        </button>
      </div>

      {/* Appointment Cards List */}
      {currentList.length === 0 ? (
        <div className="py-16 text-center card p-8 space-y-2 bg-white">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            No Appointments Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You do not currently have any appointments in the {activeTab.toLowerCase()} category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentList.map((appt) => {
            const isConfirmed = appt.status === 'CONFIRMED';
            return (
              <div
                key={appt.id}
                className="card flex flex-col justify-between p-5 bg-white shadow-xs hover:border-blue-500/30 transition-all space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-sky-600 text-sm font-bold text-white shadow-xs">
                        {appt.doctor?.fullName?.charAt(0) || 'D'}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {appt.doctor?.fullName || 'Doctor'}
                        </h4>
                        <p className="text-xs text-blue-700 font-medium capitalize truncate">
                          {appt.doctor?.specialization}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Date
                      </span>
                      <span className="font-bold text-slate-800">
                        {formatDate(appt.date)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Time Window
                      </span>
                      <span className="font-bold text-slate-800">
                        {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                      </span>
                    </div>
                  </div>

                  {appt.tokenNumber && (
                    <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/70 border border-blue-200/50 rounded-xl text-xs">
                      <span className="text-blue-800 font-medium flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                        Clinic Token
                      </span>
                      <span className="font-mono font-black text-blue-900 text-sm">
                        #{appt.tokenNumber}
                      </span>
                    </div>
                  )}
                </div>

                {/* Live Queue Tracker button */}
                {(appt.status === 'CONFIRMED' || appt.status === 'CHECKED_IN' || appt.status === 'IN_CONSULTATION') && (
                  <button
                    type="button"
                    onClick={() => setLiveQueueApptId(appt.id)}
                    className="w-full py-2 px-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 text-xs font-bold text-blue-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    <span>Track Live Queue (See who is before you)</span>
                  </button>
                )}

                {isConfirmed && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openRescheduleModal(appt)}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancellingId(appt.id)}
                      className="py-2 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-semibold text-rose-600 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm card p-6 space-y-4 bg-white shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">
                Cancel Appointment?
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to release this appointment? The doctor’s dashboard will be updated and the slot freed for others.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingId(null)}
                disabled={cancelLoading}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelLoading}
                className="btn-danger flex-1 py-2.5 text-xs font-semibold"
              >
                {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md card p-6 space-y-5 max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Reschedule Appointment
              </h3>
              <button
                type="button"
                onClick={() => setReschedulingAppt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="field-label">Select New Date</label>
              <input
                type="date"
                min={todayStr}
                value={rescheduleDate}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  setSelectedSlot(null);
                  fetchRescheduleSlots(reschedulingAppt.doctorId, e.target.value);
                }}
                className="field-input text-xs font-semibold"
              />
            </div>

            <div>
              <label className="field-label">Select Open Slot</label>

              {loadingSlots ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-700 mx-auto" />
                  <p className="text-[11px] text-slate-400 mt-2">Checking open slots...</p>
                </div>
              ) : rescheduleSlots.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 rounded-xl text-xs text-slate-500">
                  No open consultation slots found for this date.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {rescheduleSlots.map((slot, idx) => {
                    const isBookable =
                      slot.status === 'available' ||
                      slot.status === 'cancel and available for booking';
                    const isSelected = selectedSlot?.startTime === slot.startTime;

                    return (
                      <button
                        key={`${slot.startTime}-${idx}`}
                        type="button"
                        disabled={!isBookable}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-blue-700 border-blue-700 text-white shadow-xs'
                            : isBookable
                            ? 'bg-slate-50 border-slate-200 hover:border-blue-500 text-slate-800'
                            : 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                        }`}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => setReschedulingAppt(null)}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRescheduleSubmit}
                disabled={!selectedSlot || rescheduleLoading}
                className="btn-primary flex-1 py-2.5 text-xs font-semibold"
              >
                {rescheduleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirm Reschedule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Live Queue Tracker Modal */}
      {liveQueueApptId && (
        <PatientLiveQueueModal
          appointmentId={liveQueueApptId}
          isOpen={!!liveQueueApptId}
          onClose={() => setLiveQueueApptId(null)}
        />
      )}
    </div>
  );
}
