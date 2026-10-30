'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  UserX,
  RefreshCw,
  AlertCircle,
  Stethoscope,
  Sparkles,
  MapPin,
  Ticket,
  Users,
  Hourglass,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { formatDate, formatTime } from '@/lib/utils';

interface AppointmentData {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  doctorQualification: string;
  consultationFee: number;
  patientName: string;
  patientPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  tokenNumber: number | null;
  status: string;
  paymentStatus: string;
  checkedInAt: string | null;
  queuePosition: number | null;
  estimatedWaitTime: number | null;
  waitingCount: number;
  currentServingToken: number | null;
}

export default function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const appointmentId = resolvedParams.id;

  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<'checkin' | 'noshow' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAppointmentDetails = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch(`/api/kiosk/appointment/${appointmentId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load appointment details');
      }

      if (data.data) {
        setAppointment(data.data);
        setError(null);
      } else {
        throw new Error('Appointment data not found');
      }
    } catch (err: any) {
      if (!isSilent) {
        setError(err.message || 'Could not load appointment details.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppointmentDetails();
  }, [appointmentId]);

  const handleCheckIn = async () => {
    if (!appointment) return;
    setActionLoading('checkin');
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/kiosk/appointment/${appointmentId}/check-in`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Check-in failed');
      }

      setAppointment((prev) =>
        prev
          ? {
              ...prev,
              status: 'CHECKED_IN',
              checkedInAt: new Date().toISOString(),
            }
          : null,
      );

      const msg = data.message || 'Checked in successfully! You are now in the doctor’s queue.';
      toast.success(msg);
      setFeedbackMsg({ type: 'success', text: msg });

      // Silently refresh to get updated queue metrics
      setTimeout(() => {
        fetchAppointmentDetails(true);
      }, 1000);
    } catch (err: any) {
      const msg = err.message || 'Failed to check in. Please try again.';
      toast.error(msg);
      setFeedbackMsg({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async () => {
    if (!appointment) return;
    setActionLoading('noshow');
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/kiosk/appointment/${appointmentId}/no-show`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark as No-Show');
      }

      setAppointment((prev) =>
        prev
          ? {
              ...prev,
              status: 'NO_SHOW',
            }
          : null,
      );

      setShowNoShowConfirm(false);
      const msg = data.message || 'Appointment marked as No-Show.';
      toast.error(msg);
      setFeedbackMsg({ type: 'error', text: msg });

      setTimeout(() => {
        fetchAppointmentDetails(true);
      }, 1000);
    } catch (err: any) {
      const msg = err.message || 'Failed to mark as No-Show.';
      toast.error(msg);
      setFeedbackMsg({ type: 'error', text: msg });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark size="lg" className="animate-bounce" />
          <div className="h-6 w-48 animate-pulse rounded-md bg-slate-200" />
          <p className="text-sm text-slate-500">Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Appointment Not Found</h2>
          <p className="mt-2 text-sm text-slate-600">
            {error || 'The appointment linked with this QR code could not be verified or has expired.'}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => fetchAppointmentDetails()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Go to CareUp Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isConfirmed = appointment.status === 'CONFIRMED';
  const isCheckedIn = appointment.status === 'CHECKED_IN';
  const isInConsultation = appointment.status === 'IN_CONSULTATION';
  const isCompleted = appointment.status === 'COMPLETED';
  const isNoShow = appointment.status === 'NO_SHOW';
  const isCancelled = appointment.status === 'CANCELLED';

  const getStatusBadge = () => {
    if (isCheckedIn) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-semibold text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
          Checked In · Waiting for Doctor
        </span>
      );
    }
    if (isConfirmed) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3.5 py-1 text-xs font-semibold text-[#0066cc]">
          <span className="h-2 w-2 rounded-full bg-[#0066cc]" />
          Confirmed · Ready for Check-In
        </span>
      );
    }
    if (isInConsultation) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3.5 py-1 text-xs font-semibold text-purple-800">
          <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
          In Consultation
        </span>
      );
    }
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1 text-xs font-semibold text-slate-800">
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-600" />
          Completed
        </span>
      );
    }
    if (isNoShow) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3.5 py-1 text-xs font-semibold text-rose-800">
          <UserX className="h-3.5 w-3.5 text-rose-600" />
          Marked as No-Show
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3.5 py-1 text-xs font-semibold text-gray-700">
        {appointment.status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 pt-4 px-4 sm:px-6">
      <div className="mx-auto max-w-lg">
        {/* Brand Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size="md" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-slate-900 text-lg">CareUp</span>
                <span className="rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-[#0066cc]">
                  HEALTH
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Hospital Kiosk Check-In</p>
            </div>
          </div>
          <button
            onClick={() => fetchAppointmentDetails()}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
            title="Refresh status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#0066cc]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div
            className={`mb-4 flex items-center gap-2.5 rounded-xl p-3.5 text-sm font-medium transition ${
              feedbackMsg.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            )}
            <p className="flex-1">{feedbackMsg.text}</p>
          </div>
        )}

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {/* Status Top Banner */}
          <div
            className={`border-b p-4 ${
              isCheckedIn
                ? 'border-emerald-100 bg-emerald-50/70'
                : isNoShow
                ? 'border-rose-100 bg-rose-50/70'
                : 'border-blue-100 bg-gradient-to-r from-blue-50/80 to-slate-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Appointment Status
              </span>
              {getStatusBadge()}
            </div>

            {isCheckedIn && (
              <p className="mt-2 text-xs text-emerald-800 leading-relaxed font-medium">
                ✅ You are checked in! Please have a seat in the waiting area. You will be called by your token number.
              </p>
            )}

            {isConfirmed && (
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Welcome! When you arrive at the clinic, tap the <strong>Check In</strong> button below.
              </p>
            )}

            {isNoShow && (
              <p className="mt-2 text-xs text-rose-700 leading-relaxed font-medium">
                This appointment was marked as No-Show. If you are at the clinic, please contact the front desk reception.
              </p>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Doctor Info */}
            <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-[#00408a] text-white shadow-xs">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                  {appointment.doctorName}
                </h3>
                <p className="text-xs text-[#0066cc] font-semibold mt-0.5">
                  {appointment.doctorSpecialization}
                </p>
                {appointment.doctorQualification && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {appointment.doctorQualification}
                  </p>
                )}
              </div>
            </div>

            {/* Token & Slot Overview Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Token Number Card */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-center">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Your Token
                </span>
                <span className="mt-1 block text-2xl font-black text-[#0066cc]">
                  {appointment.tokenNumber !== null ? `#${appointment.tokenNumber}` : '—'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Queue Identification</span>
              </div>

              {/* Consultation Date */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-center">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </span>
                <span className="mt-1 block text-sm font-bold text-slate-900">
                  {formatDate(appointment.date)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {appointment.startTime ? `${formatTime(appointment.startTime)} – ${formatTime(appointment.endTime)}` : 'Scheduled'}
                </span>
              </div>
            </div>

            {/* Patient & Booking Details */}
            <div className="rounded-xl border border-slate-100 bg-white p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <User className="h-3.5 w-3.5 text-slate-400" /> Patient Name
                </span>
                <span className="font-semibold text-slate-900">{appointment.patientName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-slate-400" /> Time Window
                </span>
                <span className="font-semibold text-slate-900">
                  {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Payment
                </span>
                <span
                  className={`font-semibold uppercase ${
                    appointment.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {appointment.paymentStatus}
                </span>
              </div>
            </div>

            {/* Live Queue Context (when Confirmed or Checked In) */}
            {(isConfirmed || isCheckedIn) && (
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-[#0066cc]" /> Live Queue Status
                  </span>
                  <span className="text-[11px] text-slate-500">Clinic Display</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">Now Serving</span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {appointment.currentServingToken ? `Token #${appointment.currentServingToken}` : 'None'}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">In Queue</span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {appointment.waitingCount} {appointment.waitingCount === 1 ? 'patient' : 'patients'}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">Est. Wait</span>
                    <span className="text-xs font-bold text-[#0066cc] block mt-0.5">
                      {appointment.estimatedWaitTime ? `~${appointment.estimatedWaitTime}m` : 'On schedule'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="pt-2 space-y-3">
              {/* CHECK IN BUTTON */}
              {isConfirmed && (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 transition active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {actionLoading === 'checkin' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Checking In...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Check In Now</span>
                    </>
                  )}
                </button>
              )}

              {isCheckedIn && (
                <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>You are checked in (Token #{appointment.tokenNumber})</span>
                </div>
              )}

              {/* NO SHOW BUTTON */}
              {(isConfirmed || isCheckedIn) && (
                <button
                  type="button"
                  onClick={() => setShowNoShowConfirm(true)}
                  disabled={actionLoading !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-xs font-bold text-rose-700 hover:bg-rose-100/80 focus:outline-hidden focus:ring-2 focus:ring-rose-500/40 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <UserX className="h-4 w-4 text-rose-600" />
                  <span>Mark as No-Show</span>
                </button>
              )}

              {isNoShow && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-center">
                  <p className="text-xs font-semibold text-rose-800">
                    This appointment is currently marked as No-Show.
                  </p>
                  <p className="text-[11px] text-rose-600 mt-1">
                    If this is an error, please inform the clinic reception desk.
                  </p>
                </div>
              )}

              {isCompleted && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-slate-500 mb-1" />
                  <p className="text-xs font-semibold text-slate-800">Consultation Completed</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Thank you for visiting CareUp.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Help text */}
        <div className="mt-6 text-center text-xs text-slate-400 space-y-1">
          <p>CareUp Smart Hospital Check-In Kiosk</p>
          <p>Scan verification ID: #{appointment.id.slice(0, 8)}</p>
        </div>
      </div>

      {/* Confirmation Modal for No-Show */}
      {showNoShowConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <UserX className="h-6 w-6" />
            </div>
            <h3 className="text-center text-lg font-bold text-slate-900">Mark as No-Show?</h3>
            <p className="mt-2 text-center text-xs text-slate-600 leading-relaxed">
              Are you sure you want to mark <strong>{appointment.patientName}</strong> as No-Show for this appointment?
              This will update the doctor&apos;s queue and release the consultation slot.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={handleNoShow}
                disabled={actionLoading === 'noshow'}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {actionLoading === 'noshow' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4" />
                    <span>Confirm No-Show</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowNoShowConfirm(false)}
                disabled={actionLoading !== null}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

