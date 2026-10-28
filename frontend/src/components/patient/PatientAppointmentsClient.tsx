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
  Sparkles,
} from 'lucide-react';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { PatientLiveQueueModal } from './PatientLiveQueueModal';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';

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
  const now = new Date();
  const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

  // Helper to determine if an un-attended appointment slot has already ended
  const isAppointmentExpired = (a: Appointment) => {
    if (!a || !a.date) return false;
    if (a.date < todayStr) return true;
    if (a.date === todayStr && a.status === 'CONFIRMED') {
      const [endH, endM] = (a.endTime || a.startTime || '00:00').split(':').map(Number);
      const slotEndMinutes = (endH || 0) * 60 + (endM || 0);
      return currentMinutes > slotEndMinutes;
    }
    return false;
  };

  const upcomingList = appointments.filter(
    (a) =>
      ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status) &&
      !isAppointmentExpired(a),
  );

  const pastList = appointments.filter(
    (a) =>
      ['COMPLETED', 'NO_SHOW'].includes(a.status) ||
      isAppointmentExpired(a),
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
    const docId = appt.doctorId || appt.doctor?.id;
    if (!docId) {
      toast.error('Doctor information missing for this appointment');
      return;
    }
    setReschedulingAppt(appt);
    setRescheduleDate(appt.date);
    setSelectedSlot(null);
    fetchRescheduleSlots(docId, appt.date);
  };

  const fetchRescheduleSlots = async (doctorId: string, date: string) => {
    if (!doctorId || doctorId === 'undefined') {
      toast.error('Invalid doctor ID');
      setRescheduleSlots([]);
      return;
    }
    try {
      setLoadingSlots(true);
      const res = await clientAxios.get<{ data: Slot[] }>(
        `/api/doctor/${doctorId}/slots-proxy`,
        { params: { date } },
      );
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
      {/* Filter Tabs in Frosted Glass */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] pb-4">
        <button
          type="button"
          onClick={() => setActiveTab('UPCOMING')}
          className={activeTab === 'UPCOMING' ? 'pill-filter-active' : 'pill-filter-idle'}
        >
          Upcoming visits ({upcomingList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PAST')}
          className={activeTab === 'PAST' ? 'pill-filter-active' : 'pill-filter-idle'}
        >
          History ({pastList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CANCELLED')}
          className={activeTab === 'CANCELLED' ? 'pill-filter-active' : 'pill-filter-idle'}
        >
          Cancelled ({cancelledList.length})
        </button>
      </div>

      {/* Appointment Cards List */}
      {currentList.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border border-black/[0.08] bg-white/80 backdrop-blur-2xl p-8 space-y-2 shadow-xs">
          <CalendarDays className="w-8 h-8 text-zinc-400 mx-auto" />
          <h3 className="text-base font-bold text-zinc-950">
            No Appointments Found
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            You do not currently have any appointments in the {activeTab.toLowerCase()} category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentList.map((appt, index) => {
            const isExpired = isAppointmentExpired(appt);
            const displayStatus = isExpired ? 'NO_SHOW' : appt.status;
            const isConfirmed = displayStatus === 'CONFIRMED';
            const displayToken = String(appt.tokenNumber || index + 1).padStart(2, '0');
            return (
              <div
                key={appt.id}
                className="relative rounded-3xl border border-black/[0.08] bg-white/95 p-5 backdrop-blur-2xl shadow-xs transition-all duration-300 hover:border-black/20 hover:shadow-md space-y-4 overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <DoctorAvatar name={appt.doctor?.fullName || 'Doctor'} size="sm" className="rounded-xl border border-black/10" />
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-zinc-950 text-sm truncate">
                          {appt.doctor?.fullName || 'Doctor'}
                        </h4>
                        <p className="text-xs text-zinc-500 font-medium capitalize truncate">
                          {appt.doctor?.specialization}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={displayStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-black/[0.06]">
                    <div className="p-2.5 bg-black/[0.02] rounded-2xl border border-black/[0.06]">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                        Date
                      </span>
                      <span className="font-bold text-zinc-900">
                        {formatDate(appt.date)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-black/[0.02] rounded-2xl border border-black/[0.06]">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                        Time Window
                      </span>
                      <span className="font-bold text-zinc-900">
                        {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3.5 py-2 bg-black/[0.03] border border-black/[0.08] rounded-2xl text-xs">
                    <span className="text-zinc-800 font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-black" />
                      Clinic Token
                    </span>
                    <span className="font-mono font-black text-black text-sm">
                      #{displayToken}
                    </span>
                  </div>
                </div>

                {/* Live Queue Tracker button */}
                {!isExpired && (appt.status === 'CONFIRMED' || appt.status === 'CHECKED_IN' || appt.status === 'IN_CONSULTATION') && (
                  <button
                    type="button"
                    onClick={() => setLiveQueueApptId(appt.id)}
                    className="w-full py-2.5 px-3 rounded-full bg-black text-white hover:bg-zinc-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Track Live Queue (Tokens Ahead)</span>
                  </button>
                )}

                {isConfirmed && (
                  <div className="pt-2 border-t border-black/[0.06] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openRescheduleModal(appt)}
                      className="btn-secondary flex-1 !py-2 text-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancellingId(appt.id)}
                      className="btn-danger flex-1 !py-2 text-xs"
                    >
                      <XCircle className="w-3 h-3" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl border border-black/[0.08] bg-white p-6 space-y-4 backdrop-blur-2xl shadow-2xl text-zinc-900">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-zinc-950">
                Cancel Appointment?
              </h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-6 space-y-5 max-h-[90vh] overflow-y-auto backdrop-blur-2xl shadow-2xl text-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h3 className="font-bold text-zinc-950 text-base">
                Reschedule Appointment
              </h3>
              <button
                type="button"
                onClick={() => setReschedulingAppt(null)}
                className="p-1 rounded-full text-zinc-400 hover:text-black"
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
                  const docId = reschedulingAppt.doctorId || reschedulingAppt.doctor?.id;
                  if (docId) {
                    fetchRescheduleSlots(docId, e.target.value);
                  }
                }}
                className="field-input text-xs font-semibold"
              />
            </div>

            <div>
              <label className="field-label">Select Open Slot</label>

              {loadingSlots ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-black mx-auto" />
                  <p className="text-[11px] text-zinc-400 mt-2">Checking open slots...</p>
                </div>
              ) : rescheduleSlots.length === 0 ? (
                <div className="p-4 text-center bg-black/[0.02] border border-black/[0.06] rounded-2xl text-xs text-zinc-500">
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
                            ? 'bg-black border-black text-white shadow-xs'
                            : isBookable
                            ? 'bg-white border-black/[0.1] hover:border-black text-zinc-800'
                            : 'opacity-40 cursor-not-allowed bg-zinc-100 text-zinc-400'
                        }`}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-black/[0.06] flex gap-2">
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
