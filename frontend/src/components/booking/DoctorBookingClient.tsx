'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatTime, formatDate, formatCurrency, getTodayIST } from '@/lib/utils';
import { Doctor, Slot, SessionUser } from '@/types';
import { toast } from 'sonner';
import {
  Clock,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sun,
  Sunset,
  Moon,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { clientAxios, extractErrorMessage } from '@/lib/api/axios';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DoctorBookingClientProps {
  doctor: Doctor;
  user: SessionUser | null;
}

export function DoctorBookingClient({ doctor, user }: DoctorBookingClientProps) {
  const router = useRouter();
  const todayIST = getTodayIST();
  const maxDays = doctor.maxFutureBookingDays ?? 14;

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
    (s) =>
      s.status === 'available' ||
      s.status === 'cancel and available for booking',
  ).length;

  return (
    <div className="space-y-6">
      {/* Date Picker Strip */}
      <Card className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          <Clock className="w-4 h-4 text-[#0066cc]" />
          Select Consultation Date
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {availableDates.map((item) => {
            const isSelected = selectedDate === item.dateStr;
            return (
              <Button
                key={item.dateStr}
                type="button"
                variant="ghost"
                onClick={() => setSelectedDate(item.dateStr)}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border py-3 px-4 min-w-[72px] text-center transition-all duration-150 h-auto ${
                  isSelected
                    ? 'border-[#0066cc] bg-[#0066cc] text-white shadow-sm hover:bg-[#0055b3] hover:text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {item.dayName}
                </span>
                <span className="text-xl font-black mt-1 leading-none">
                  {item.dayNum}
                </span>
                <span className={`text-[11px] font-semibold mt-1.5 ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                  {item.label}
                </span>
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Slots Section */}
      <Card className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e8f2fe] text-[#0066cc]">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Available Slots for {formatDate(selectedDate)}
              </h2>
              <p className="text-[11px] text-slate-500">Tap an available time to hold and confirm</p>
            </div>
          </div>
          {!loadingSlots && !onLeave && slots.length > 0 && (
            <Badge variant="outline" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-semibold text-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {availableCount} {availableCount === 1 ? 'Slot' : 'Slots'} Open
            </Badge>
          )}
        </div>

        {loadingSlots ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-black" />
            <p className="text-xs font-semibold text-zinc-500">Loading doctor availability…</p>
          </div>
        ) : onLeave ? (
          <div className="py-12 text-center rounded-3xl border border-amber-200 bg-amber-50/50 p-6 space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-900">
              Doctor is On Leave
            </h3>
            <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed">
              Dr. {doctor.fullName} is officially on approved leave on {formatDate(selectedDate)}. Please choose another date from the calendar.
            </p>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-12 text-center rounded-3xl bg-zinc-50 p-6 space-y-2 border border-black/[0.06]">
            <Clock className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-900">
              No Slots Scheduled
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              There are no consultation slots configured for this date. Please select an upcoming date.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Morning Slots */}
            {morningSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  <Sun className="h-3.5 w-3.5 text-zinc-500" />
                  Morning
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {morningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            {/* Afternoon Slots */}
            {afternoonSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  <Sunset className="h-3.5 w-3.5 text-zinc-500" />
                  Afternoon
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {afternoonSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            {/* Evening Slots */}
            {eveningSlots.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  <Moon className="h-3.5 w-3.5 text-zinc-500" />
                  Evening
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {eveningSlots.map((slot, idx) => renderSlotButton(slot, idx))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-5 border-t border-slate-100 pt-4 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0066cc]" />
                Available Slot
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
                Reserved / Booked
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Modal via shadcn Dialog */}
      <Dialog open={showConfirmModal && !!selectedSlot} onOpenChange={(open) => !open && setShowConfirmModal(false)}>
        {selectedSlot && (
          <DialogContent className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xl text-slate-900">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0066cc]" />
                <DialogTitle className="text-base font-bold text-slate-900">Confirm Your Appointment</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 p-4 border border-slate-100">
                <DoctorAvatar name={doctor.fullName} size="md" className="rounded-xl border border-slate-200 shadow-2xs" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{doctor.fullName}</h4>
                  <p className="text-xs font-semibold text-slate-600 capitalize">
                    {doctor.specialization} • {doctor.qualification}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Date
                  </span>
                  <span className="font-bold text-slate-900 block">
                    {formatDate(selectedDate)}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Slot Time
                  </span>
                  <span className="font-bold text-slate-900 block">
                    {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                  </span>
                </div>
              </div>

              {doctor.consultationFee > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                  <span className="font-semibold text-slate-600">Consultation Fee</span>
                  <span className="text-base font-extrabold text-[#0066cc]">
                    {formatCurrency(doctor.consultationFee)}
                  </span>
                </div>
              )}

              <div className="rounded-xl bg-[#f0f7ff] border border-[#bae0fd] p-3.5 text-xs leading-relaxed text-slate-700 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#0066cc] shrink-0 mt-0.5" />
                <span>
                  Booking is saved instantly to your calendar. Your live token number and wait forecast will appear in your patient dashboard.
                </span>
              </div>
            </div>

            {user?.role === 'DOCTOR' ? (
              <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl text-center font-semibold border border-rose-200">
                You are currently signed in as a Doctor. Please log in with a Patient account to book visits.
              </div>
            ) : !user ? (
              <Button asChild className="btn-primary w-full py-3 text-xs font-semibold rounded-xl h-auto">
                <Link href={`/login?next=/doctors/${doctor.id}`}>
                  <span>Sign In to Complete Booking</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={bookingInProgress}
                  className="btn-secondary flex-1 py-2.5 text-xs font-semibold rounded-xl h-auto"
                >
                  Change Slot
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleConfirmBooking}
                  disabled={bookingInProgress}
                  className="btn-primary flex-1 py-2.5 text-xs font-semibold rounded-xl h-auto"
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
                </Button>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );

  function renderSlotButton(slot: Slot, index: number) {
    const isBookable =
      slot.status === 'available' ||
      slot.status === 'cancel and available for booking';

    return (
      <Button
        key={`${slot.startTime}-${index}`}
        type="button"
        variant="ghost"
        disabled={!isBookable}
        onClick={() => handleSelectSlot(slot)}
        className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full border py-2 px-3 text-center transition-all duration-150 h-auto ${
          isBookable
            ? 'border-slate-200 bg-white text-slate-800 hover:border-[#0066cc] hover:bg-[#0066cc] hover:text-white shadow-2xs active:scale-95'
            : 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400 opacity-60'
        }`}
      >
        <span className="text-xs font-bold tracking-tight">
          {formatTime(slot.startTime)}
        </span>
        <span className="text-[9px] uppercase font-bold tracking-wider opacity-75">
          {isBookable ? 'Available' : 'Booked'}
        </span>
      </Button>
    );
  }
}
