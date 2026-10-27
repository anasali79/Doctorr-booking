'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatTime, formatDate, formatCurrency, getTodayIST } from '@/lib/utils';
import { Doctor, Slot, SessionUser } from '@/types';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  Clock,
  ShieldCheck,
  ArrowRight,
  Loader2,
  X,
  AlertCircle,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';

interface DoctorBookingClientProps {
  doctor: Doctor;
  user: SessionUser | null;
}

export function DoctorBookingClient({ doctor, user }: DoctorBookingClientProps) {
  const router = useRouter();
  const todayIST = getTodayIST();
  const maxDays = doctor.maxFutureBookingDays ?? 7;

  // Generate available dates from todayIST
  const availableDates: { dateStr: string; label: string; dayName: string; dayNum: string }[] = [];
  const baseDate = new Date();
  const totalDays = doctor.allowFutureBooking ? Math.max(1, maxDays) : 1;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date();
    d.setDate(baseDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = i === 0;
    const isTomorrow = i === 1;
    const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-IN', { month: 'short' });
    const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const dayNum = String(d.getDate());
    availableDates.push({ dateStr, label, dayName, dayNum });
  }

  const [selectedDate, setSelectedDate] = useState<string>(availableDates[0]?.dateStr || todayIST);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [onLeave, setOnLeave] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch slots using Axios
  const fetchSlots = async (date: string) => {
    try {
      setLoadingSlots(true);
      const res = await clientAxios.get<{
        message?: string;
        data: Slot[];
        onLeave?: boolean;
      }>(`/api/doctor/${doctor.id}/slots-proxy`, {
        params: { date },
      });

      setSlots(res.data.data || []);
      setOnLeave(Boolean(res.data.onLeave));
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      toast.error('Could not load consultation slots', { description: msg });
      setSlots([]);
      setOnLeave(false);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      setSelectedSlot(null);
      fetchSlots(selectedDate);
    }
  }, [selectedDate]);

  const handleSelectSlot = (slot: Slot) => {
    const isBookable =
      slot.status === 'available' ||
      slot.status === 'cancel and available for booking';

    if (!isBookable) return;
    setSelectedSlot(slot);
    setShowConfirmModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;

    if (!user) {
      router.push(`/login?next=/doctors/${doctor.id}`);
      return;
    }

    if (user.role === 'DOCTOR') {
      toast.error('Clinical Restriction', {
        description: 'Doctor accounts cannot book appointments. Please use a patient account.',
      });
      return;
    }

    try {
      setBookingInProgress(true);
      await clientAxios.post<{
        message: string;
        data: any;
      }>('/api/appointment/book', {
        doctorId: doctor.id,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });

      toast.success('Appointment Confirmed!', {
        description: `Reserved with ${doctor.fullName} on ${formatDate(selectedDate)} at ${formatTime(selectedSlot.startTime)}`,
      });

      setShowConfirmModal(false);
      router.push('/patient/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      toast.error('Booking Conflict', {
        description: msg || 'Slot might have just been taken by another patient.',
      });
      fetchSlots(selectedDate);
      setShowConfirmModal(false);
    } finally {
      setBookingInProgress(false);
    }
  };

  // Group slots by time period
  const morningSlots = slots.filter((s) => parseInt(s.startTime.split(':')[0], 10) < 12);
  const afternoonSlots = slots.filter((s) => {
    const h = parseInt(s.startTime.split(':')[0], 10);
    return h >= 12 && h < 17;
  });
  const eveningSlots = slots.filter((s) => parseInt(s.startTime.split(':')[0], 10) >= 17);

  const availableCount = slots.filter(
    (s) => s.status === 'available' || s.status === 'cancel and available for booking',
  ).length;

  return (
    <div className="space-y-6">
      {/* Date Carousel */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Choose Consultation Date</h2>
              <p className="text-[11px] text-slate-400">Slots refresh automatically in real-time</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Asia/Kolkata (IST)
          </span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {availableDates.map((item) => {
            const isSelected = selectedDate === item.dateStr;
            return (
              <button
                key={item.dateStr}
                type="button"
                onClick={() => setSelectedDate(item.dateStr)}
                className={`flex min-w-[96px] cursor-pointer flex-col items-center justify-center rounded-2xl border p-3.5 text-center transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-700 bg-gradient-to-b from-blue-700 to-blue-800 text-white shadow-md shadow-blue-900/15 scale-[1.02]'
                    : 'border-slate-200/90 bg-slate-50/70 text-slate-700 hover:border-blue-300 hover:bg-white hover:shadow-xs'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                  {item.dayName}
                </span>
                <span className="text-xl font-black mt-0.5 leading-none">
                  {item.dayNum}
                </span>
                <span className={`text-[11px] font-semibold mt-1.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots Section */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Available Slots for {formatDate(selectedDate)}
              </h2>
              <p className="text-[11px] text-slate-400">Click an open slot to reserve your consultation</p>
            </div>
          </div>
          {!loadingSlots && !onLeave && slots.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200/60 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {availableCount} {availableCount === 1 ? 'Slot' : 'Slots'} Open
            </span>
          )}
        </div>

        {loadingSlots ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-700" />
            <p className="text-xs font-semibold text-slate-400">Checking real-time doctor availability…</p>
          </div>
        ) : onLeave ? (
          <div className="py-12 text-center rounded-2xl border border-amber-200 bg-amber-50/70 p-6 space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <h3 className="text-sm font-bold text-amber-900">
              Doctor is On Leave
            </h3>
            <p className="text-xs text-amber-700 max-w-sm mx-auto leading-relaxed">
              Dr. {doctor.fullName} is officially on approved leave on {formatDate(selectedDate)}. Please choose another date from the calendar.
            </p>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-slate-50/80 p-6 space-y-2 border border-slate-200/70">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              No Slots Scheduled
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              There are no available consultation slots configured for this date. Please select an upcoming date.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Morning Slots */}
            {morningSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  Morning Consultation
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {morningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            {/* Afternoon Slots */}
            {afternoonSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  <Sunset className="h-3.5 w-3.5 text-orange-500" />
                  Afternoon Consultation
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {afternoonSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            {/* Evening Slots */}
            {eveningSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  <Moon className="h-3.5 w-3.5 text-indigo-500" />
                  Evening Consultation
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {eveningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600 shadow-xs" />
                Available Slot
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
                Occupied / Reserved
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">Confirm Your Appointment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3.5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-blue-800 text-lg font-bold text-white shadow-xs">
                  {doctor.fullName?.charAt(0) || 'D'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{doctor.fullName}</h4>
                  <p className="text-xs font-semibold text-blue-700 capitalize">
                    {doctor.specialization} • {doctor.qualification}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Date
                  </span>
                  <span className="font-bold text-slate-800 block">
                    {formatDate(selectedDate)}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Slot Time
                  </span>
                  <span className="font-bold text-slate-800 block">
                    {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                <span className="font-semibold text-slate-600">Consultation Fee</span>
                <span className="text-base font-extrabold text-slate-900">
                  {formatCurrency(doctor.consultationFee)}
                </span>
              </div>

              <div className="rounded-xl bg-blue-50/80 border border-blue-200/60 p-3.5 text-xs leading-relaxed text-blue-900 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  Booking is locked instantly. Your sequential token and queue wait time will appear on your dashboard.
                </span>
              </div>
            </div>

            {user?.role === 'DOCTOR' ? (
              <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl text-center font-semibold border border-rose-200">
                You are currently signed in as a Doctor. Please log in with a Patient account to book visits.
              </div>
            ) : !user ? (
              <Link
                href={`/login?next=/doctors/${doctor.id}`}
                className="btn-primary w-full py-3"
              >
                <span>Sign In to Complete Booking</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={bookingInProgress}
                  className="btn-secondary flex-1 py-3 text-xs"
                >
                  Change Slot
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={bookingInProgress}
                  className="btn-primary flex-1 py-3 text-xs"
                >
                  {bookingInProgress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Locking Slot…</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Book</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function renderSlotButton(slot: Slot, index: number) {
    const isBookable =
      slot.status === 'available' ||
      slot.status === 'cancel and available for booking';

    return (
      <button
        key={`${slot.startTime}-${index}`}
        type="button"
        disabled={!isBookable}
        onClick={() => handleSelectSlot(slot)}
        className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border p-2.5 text-center transition-all duration-150 ${
          isBookable
            ? 'border-blue-200 bg-blue-50/70 text-slate-800 hover:border-blue-700 hover:bg-blue-700 hover:text-white shadow-2xs active:scale-95'
            : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50'
        }`}
      >
        <span className="text-xs font-bold tracking-tight">
          {formatTime(slot.startTime)}
        </span>
        <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">
          {isBookable ? 'Available' : 'Booked'}
        </span>
      </button>
    );
  }
}
