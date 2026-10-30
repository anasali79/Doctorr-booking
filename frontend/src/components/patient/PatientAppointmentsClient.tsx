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
  AlertTriangle,
  Activity,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { launchRazorpayCheckout } from '@/lib/razorpay';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { PatientLiveQueueModal } from './PatientLiveQueueModal';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PatientAppointmentsClientProps {
  initialAppointments: Appointment[];
}

export function PatientAppointmentsClient({
  initialAppointments,
}: PatientAppointmentsClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initialAppointments);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'PAST' | 'CANCELLED' | 'PENDING'>('UPCOMING');
  const [retryingPaymentId, setRetryingPaymentId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cancel dialog state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReasonPreset, setCancelReasonPreset] = useState('Change of plans / Schedule conflict');
  const [cancelReasonCustom, setCancelReasonCustom] = useState('');

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

  const pendingList = appointments.filter(
    (a) =>
      a.status === 'PENDING_PAYMENT' &&
      a.pendingExpiresAt &&
      new Date(a.pendingExpiresAt).getTime() > nowMs,
  );

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
    (a) =>
      a.status === 'CANCELLED' ||
      a.status === 'RESCHEDULED' ||
      (a.status === 'PENDING_PAYMENT' && (!a.pendingExpiresAt || new Date(a.pendingExpiresAt).getTime() <= nowMs)),
  );

  const currentList =
    activeTab === 'PENDING'
      ? pendingList
      : activeTab === 'UPCOMING'
      ? upcomingList
      : activeTab === 'PAST'
      ? pastList
      : cancelledList;

  // Retry payment for pending reservation
  const handleRetryPayment = async (appt: Appointment) => {
    try {
      setRetryingPaymentId(appt.id);
      const res = await clientAxios.post<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        appointmentId: string;
        expiresAt: string;
      }>('/api/payment/retry-order', {
        appointmentId: appt.id,
      });

      const orderData = res.data;

      await launchRazorpayCheckout({
        orderData,
        doctorName: appt.doctor?.fullName || 'Doctor',
        onSuccess: () => {
          toast.success('Payment Received! Your appointment is confirmed.');
          setAppointments((prev) =>
            prev.map((a) =>
              a.id === appt.id
                ? { ...a, status: 'CONFIRMED', paymentStatus: 'PAID', pendingExpiresAt: null }
                : a,
            ),
          );
          router.refresh();
        },
        onFailure: (err: any) => {
          toast.error('Payment Incomplete', {
            description: extractErrorMessage(err) || 'You can retry before the 15-minute reservation expires.',
          });
        },
      });
    } catch (err) {
      toast.error('Could not initiate payment', {
        description: extractErrorMessage(err),
      });
    } finally {
      setRetryingPaymentId(null);
    }
  };

  const handleCancelPending = async (appointmentId: string) => {
    try {
      setCancelLoading(true);
      await clientAxios.patch('/api/appointment/' + appointmentId + '/cancel', {
        reason: 'Cancelled pending reservation',
      });
      toast.success('Reservation Cancelled', {
        description: 'The reserved slot has been released back immediately.',
      });
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      router.refresh();
    } catch (err) {
      toast.error('Failed to cancel reservation', {
        description: extractErrorMessage(err),
      });
    } finally {
      setCancelLoading(false);
    }
  };

  // Handle Cancel via Axios
  const apptToCancel = appointments.find((a) => a.id === cancellingId);
  const isPaidAppointment = apptToCancel?.paymentStatus === 'PAID';
  const fee = apptToCancel?.doctor?.consultationFee || 500;

  const handleCancel = async () => {
    if (!cancellingId) return;

    const finalReason =
      cancelReasonPreset === 'Other'
        ? cancelReasonCustom.trim() || 'Patient requested cancellation'
        : cancelReasonCustom.trim()
        ? (cancelReasonPreset + ': ' + cancelReasonCustom.trim())
        : cancelReasonPreset;

    try {
      setCancelLoading(true);
      const res = await clientAxios.patch('/api/appointment/' + cancellingId + '/cancel', {
        reason: finalReason,
      });

      const refundData = res.data?.data?.refund;
      if (refundData || isPaidAppointment) {
        toast.success('Appointment Cancelled & Refund Initiated!', {
          description: 'Full refund of ₹' + fee + ' has been requested. It will be credited to your account via Razorpay within 5–7 business days.',
        });
      } else {
        toast.success('Appointment Cancelled', {
          description: 'The consultation slot has been released back to the clinic.',
        });
      }

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === cancellingId
            ? { ...a, status: 'CANCELLED', paymentStatus: isPaidAppointment ? 'REFUNDED' : a.paymentStatus }
            : a,
        ),
      );
      setCancellingId(null);
      setCancelReasonCustom('');
      setCancelReasonPreset('Change of plans / Schedule conflict');
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
      const res = await clientAxios.patch<{
        message: string;
        data: any;
      }>(`/api/appointment/${reschedulingAppt.id}/reschedule`, {
        date: rescheduleDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        newDate: rescheduleDate,
        newStartTime: selectedSlot.startTime,
        newEndTime: selectedSlot.endTime,
      });

      toast.success('Appointment Rescheduled!', {
        description: `New slot on ${formatDate(rescheduleDate)} at ${formatTime(selectedSlot.startTime)}`,
      });

      const resData = res.data?.data;
      const newAppt = resData?.newAppointment || resData;

      if (newAppt && newAppt.id) {
        setAppointments((prev) => [
          newAppt,
          ...prev.filter((a) => a.id !== reschedulingAppt.id && a.id !== newAppt.id),
        ]);
      }
      setReschedulingAppt(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error('Reschedule Failed', { description: extractErrorMessage(err) });
    } finally {
      setRescheduleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Pending Reservations Alert Banner */}
      {pendingList.length > 0 && (
        <Card className="rounded-3xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs space-y-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-200/80 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-800 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  Pending Payment — Slot Held for 15 Minutes ({pendingList.length})
                </h3>
                <p className="text-xs text-amber-700">
                  Complete your payment before time expires to secure your consultation slot.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto">
              Held for 15 min
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {pendingList.map((pAppt) => {
              const remainingMs = Math.max(0, new Date(pAppt.pendingExpiresAt!).getTime() - nowMs);
              const mins = Math.floor(remainingMs / 60000);
              const secs = Math.floor((remainingMs % 60000) / 1000);
              const timerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

              return (
                <div key={pAppt.id} className="bg-white rounded-2xl border border-amber-200/90 p-4 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <DoctorAvatar name={pAppt.doctor?.fullName || 'Doctor'} size="sm" className="rounded-xl border border-black/10" />
                      <div>
                        <h4 className="font-bold text-zinc-950 text-sm">
                          Dr. {pAppt.doctor?.fullName || 'Doctor'}
                        </h4>
                        <p className="text-xs text-zinc-500 capitalize">
                          {pAppt.doctor?.specialization}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <Clock className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                      {timerText} left
                    </span>
                  </div>

                  <div className="text-xs text-zinc-600 flex items-center gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-medium">{formatDate(pAppt.date)} at {formatTime(pAppt.startTime)} - {formatTime(pAppt.endTime)}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={() => handleRetryPayment(pAppt)}
                      disabled={retryingPaymentId === pAppt.id}
                      className="flex-1 bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold text-xs h-9 rounded-xl shadow-xs"
                    >
                      {retryingPaymentId === pAppt.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Complete Payment Now
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleCancelPending(pAppt.id)}
                      disabled={cancelLoading}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-9 px-3 rounded-xl"
                    >
                      Cancel Slot
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filter Tabs in Frosted Glass */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] pb-4 overflow-x-auto">
        {pendingList.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('PENDING')}
            className={`h-auto font-bold ${activeTab === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-800 bg-amber-100/70 hover:bg-amber-200/70'}`}
          >
            Pending Payment ({pendingList.length})
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('UPCOMING')}
          className={`h-auto ${activeTab === 'UPCOMING' ? 'pill-filter-active' : 'pill-filter-idle'}`}
        >
          Upcoming visits ({upcomingList.length})
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('PAST')}
          className={`h-auto ${activeTab === 'PAST' ? 'pill-filter-active' : 'pill-filter-idle'}`}
        >
          History ({pastList.length})
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('CANCELLED')}
          className={`h-auto ${activeTab === 'CANCELLED' ? 'pill-filter-active' : 'pill-filter-idle'}`}
        >
          Cancelled ({cancelledList.length})
        </Button>
      </div>

      {/* Appointment Cards List */}
      {currentList.length === 0 ? (
        <Card className="py-16 text-center rounded-3xl border border-black/[0.08] bg-white/80 backdrop-blur-2xl p-8 space-y-2 shadow-xs">
          <CalendarDays className="w-8 h-8 text-zinc-400 mx-auto" />
          <h3 className="text-base font-bold text-zinc-950">
            No Appointments Found
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            You do not currently have any appointments in the {activeTab.toLowerCase()} category.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentList.map((appt, index) => {
            const isExpired = isAppointmentExpired(appt);
            const displayStatus = isExpired ? 'NO_SHOW' : appt.status;
            const isConfirmed = displayStatus === 'CONFIRMED';
            const displayToken = String(appt.tokenNumber || index + 1).padStart(2, '0');
            return (
              <Card
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

                {/* Pending Payment Card Action */}
                {appt.status === 'PENDING_PAYMENT' && (
                  <div className="pt-2 border-t border-amber-200/80 space-y-2">
                    {appt.pendingExpiresAt && new Date(appt.pendingExpiresAt).getTime() > nowMs ? (
                      <>
                        <div className="flex items-center justify-between text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                            Reservation expires in:
                          </span>
                          <span className="font-mono font-bold">
                            {(() => {
                              const rem = Math.max(0, new Date(appt.pendingExpiresAt).getTime() - nowMs);
                              const m = Math.floor(rem / 60000);
                              const s = Math.floor((rem % 60000) / 1000);
                              return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => handleRetryPayment(appt)}
                            disabled={retryingPaymentId === appt.id}
                            className="flex-1 bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold text-xs h-9 rounded-xl shadow-xs"
                          >
                            {retryingPaymentId === appt.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5 mr-1" />
                            )}
                            Pay Now
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleCancelPending(appt.id)}
                            disabled={cancelLoading}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-9 px-3 rounded-xl"
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="p-2 text-center text-xs font-semibold text-zinc-500 bg-zinc-100 rounded-xl">
                        Reservation Expired (Slot Released)
                      </div>
                    )}
                  </div>
                )}

                {/* Live Queue Tracker button */}
                {!isExpired && (appt.status === 'CONFIRMED' || appt.status === 'CHECKED_IN' || appt.status === 'IN_CONSULTATION') && (
                  <Button
                    type="button"
                    variant="black"
                    onClick={() => setLiveQueueApptId(appt.id)}
                    className="w-full py-2.5 px-3 rounded-full bg-black text-white hover:bg-zinc-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs h-auto"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Track Live Queue (Tokens Ahead)</span>
                  </Button>
                )}

                {isConfirmed && (
                  <div className="pt-2 border-t border-black/[0.06] flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openRescheduleModal(appt)}
                      className="btn-secondary flex-1 !py-2 text-xs h-auto"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reschedule</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCancellingId(appt.id)}
                      className="btn-danger flex-1 !py-2 text-xs h-auto"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>Cancel</span>
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <Dialog
        open={!!cancellingId}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingId(null);
            setCancelReasonCustom('');
          }
        }}
      >
        <DialogContent className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-6 space-y-4 backdrop-blur-2xl shadow-2xl text-zinc-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <DialogTitle className="font-bold text-base text-zinc-950">
                  Cancel Appointment
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                  {apptToCancel ? ('Dr. ' + (apptToCancel.doctor?.fullName || 'Doctor') + ' • ' + formatDate(apptToCancel.date) + ' at ' + formatTime(apptToCancel.startTime)) : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Refund Notice Card */}
          {isPaidAppointment ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  100% Refund Eligible
                </span>
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  ₹{fee}
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Since you are cancelling in advance, your consultation fee of ₹{fee} will be automatically refunded back to your original payment method in 5–7 banking days via Razorpay.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              No prepayment was charged for this appointment. Slot will be released back to the clinic schedule immediately.
            </div>
          )}

          {/* Cancellation Reason Selection */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-slate-800 block">
              Reason for Cancellation <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                'Change of plans / Schedule conflict',
                'Feeling better / Recovered',
                'Doctor unavailable / Delayed',
                'Booked incorrect slot or doctor',
                'Other',
              ].map((preset) => (
                <label
                  key={preset}
                  className={'flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ' +
                    (cancelReasonPreset === preset
                      ? 'border-[#0066cc] bg-blue-50/50 text-[#0066cc] font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700')}
                >
                  <Input type="radio" name="cancelReason" value={preset} checked={cancelReasonPreset === preset} onChange={() => setCancelReasonPreset(preset)} className="accent-[#0066cc] w-4 h-4 shadow-none border-slate-300 p-0 inline-block h-4" />
                  <span>{preset}</span>
                </label>
              ))}
            </div>

            {/* Custom Notes */}
            <div className="pt-1">
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Additional Comments (Optional)
              </label>
              <Input
                placeholder="Tell clinic staff more details..."
                value={cancelReasonCustom}
                onChange={(e) => setCancelReasonCustom(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCancellingId(null);
                setCancelReasonCustom('');
              }}
              disabled={cancelLoading}
              className="flex-1 py-2 text-xs font-semibold rounded-xl"
            >
              Keep Booking
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
              className="flex-1 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
            >
              {cancelLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPaidAppointment ? (
                'Confirm Cancel & Refund'
              ) : (
                'Yes, Cancel Slot'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Modal */}
      <Dialog open={!!reschedulingAppt} onOpenChange={(open) => !open && setReschedulingAppt(null)}>
        <DialogContent className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-6 space-y-5 max-h-[90vh] overflow-y-auto backdrop-blur-2xl shadow-2xl text-zinc-900">
          <DialogHeader>
            <DialogTitle className="font-bold text-zinc-950 text-base pb-3 border-b border-black/[0.06]">
              Reschedule Appointment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Select New Date</label>
              <Input
                type="date"
                min={todayStr}
                value={rescheduleDate}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  setSelectedSlot(null);
                  const docId = reschedulingAppt?.doctorId || reschedulingAppt?.doctor?.id;
                  if (docId) {
                    fetchRescheduleSlots(docId, e.target.value);
                  }
                }}
                className="text-xs font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Select Open Slot</label>

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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {rescheduleSlots.map((slot, idx) => {
                    const isBookable =
                      slot.status === 'available' ||
                      slot.status === 'cancel and available for booking';
                    const isSelected = selectedSlot?.startTime === slot.startTime;

                    return (
                      <Button
                        key={`${slot.startTime}-${slot.endTime}-${idx}`}
                        type="button"
                        disabled={!isBookable}
                        variant="ghost"
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all h-auto flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-black border-black text-white shadow-xs hover:bg-black hover:text-white'
                            : isBookable
                            ? 'bg-white border-black/[0.1] hover:border-black text-zinc-800'
                            : 'opacity-40 cursor-not-allowed bg-zinc-100 text-zinc-400'
                        }`}
                      >
                        <span className="whitespace-nowrap">
                          {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                        </span>
                        {slot.schedulingType === 'WAVE' ? (
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-200' : 'text-[#0066cc]'}`}>
                            Wave ({slot.availableCount ?? 1} left)
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium opacity-75">
                            {isBookable ? 'Available' : 'Booked'}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-black/[0.06] flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReschedulingAppt(null)}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold h-auto"
              >
                Close
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleRescheduleSubmit}
                disabled={!selectedSlot || rescheduleLoading}
                className="btn-primary flex-1 py-2.5 text-xs font-semibold h-auto"
              >
                {rescheduleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirm Reschedule'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
