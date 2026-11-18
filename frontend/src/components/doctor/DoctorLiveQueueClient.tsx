'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import { formatTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import {
  RefreshCw,
  Clock,
  Stethoscope,
  FileText,
  Users,
  User,
  ArrowRight,
  List,
  CheckCircle2,
  Hourglass,
  Search,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SmoothDatePicker } from '@/components/ui/smooth-date-picker';
import { DoctorPrescriptionModal } from '@/components/prescription/DoctorPrescriptionModal';
import { useAppointmentSocket } from '@/hooks/useAppointmentSocket';

type ActionType = 'start-consultation' | 'complete' | 'no-show';

interface DoctorLiveQueueClientProps {
  initialAppointments: Appointment[];
  selectedDate: string;
  todayIST: string;
  doctorId?: string;
}

export function DoctorLiveQueueClient({
  initialAppointments,
  selectedDate,
  doctorId,
}: DoctorLiveQueueClientProps) {
  const router = useRouter();
  const [activeDate, setActiveDate] = useState<string>(selectedDate);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [prevInitialAppointments, setPrevInitialAppointments] = useState(initialAppointments);
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [prescriptionAppt, setPrescriptionAppt] = useState<Appointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync state when props change during render
  if (initialAppointments !== prevInitialAppointments) {
    setPrevInitialAppointments(initialAppointments);
    setAppointments(initialAppointments);
  }

  if (selectedDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedDate);
    setActiveDate(selectedDate);
  }

  const fetchAppointments = useCallback(async (dateToFetch?: string) => {
    const targetDate = dateToFetch || activeDate;
    setRefreshing(true);
    try {
      const res = await clientAxios.get(`/api/doctor/appointments?date=${targetDate}`);
      const data = res.data?.data || res.data || [];
      setAppointments(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, [activeDate]);

  const handleDateChange = useCallback(
    async (newDate: string) => {
      setActiveDate(newDate);
      router.replace(`/doctor/appointments?date=${newDate}`, { scroll: false });
      setRefreshing(true);
      try {
        const res = await clientAxios.get(`/api/doctor/appointments?date=${newDate}`);
        const data = res.data?.data || res.data || [];
        setAppointments(Array.isArray(data) ? data : []);
      } catch {
        toast.error('Failed to load appointments');
      } finally {
        setRefreshing(false);
      }
    },
    [router],
  );

  // Real-time socket sync
  const { isConnected } = useAppointmentSocket({
    role: 'doctor',
    profileId: doctorId,
    onEvent: (event) => {
      if (
        event === 'queue.updated' ||
        event === 'doctor.status.board' ||
        event === 'appointment.updated' ||
        event === 'appointment.created' ||
        event === 'appointment.cancelled'
      ) {
        fetchAppointments(activeDate);
      }
    },
  });

  useEffect(() => {
    const tick = () =>
      setCurrentTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await clientAxios.get(`/api/doctor/appointments?date=${activeDate}`);
      const data = res.data?.data || res.data || [];
      setAppointments(Array.isArray(data) ? data : []);
      toast.success('Queue refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [activeDate]);

  const handleAction = async (appointmentId: string, action: ActionType) => {
    const lid = `${appointmentId}-${action}`;
    setLoadingId(lid);
    try {
      await clientAxios.post(`/api/doctor/appointments/${appointmentId}/action?action=${action}`);
      const labels: Record<ActionType, string> = {
        'start-consultation': 'Consultation started (Patient in Cabin)',
        complete: 'Consultation completed ✓',
        'no-show': 'Marked as no-show',
      };
      toast.success(labels[action]);
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id !== appointmentId) return a;
          const n = { ...a };
          if (action === 'start-consultation') n.status = 'IN_CONSULTATION';
          else if (action === 'complete') n.status = 'COMPLETED';
          else if (action === 'no-show') n.status = 'NO_SHOW';
          return n;
        }),
      );
      router.refresh();
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Action failed';
      toast.error(errorMsg || 'Action failed');
    } finally {
      setLoadingId(null);
    }
  };

  /* Queue categorization */
  const activeAppt = appointments.find((a) => a.status === 'IN_CONSULTATION');
  const checkedInList = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'CHECKED_IN')
        .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999)),
    [appointments],
  );
  const confirmedList = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'CONFIRMED')
        .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999)),
    [appointments],
  );
  const completedList = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'COMPLETED')
        .sort((a, b) => (a.tokenNumber ?? 999) - (b.tokenNumber ?? 999)),
    [appointments],
  );
  const otherList = useMemo(
    () => appointments.filter((a) => ['CANCELLED', 'NO_SHOW'].includes(a.status)),
    [appointments],
  );

  const waitingCount = checkedInList.length;
  const stillArrivingCount = confirmedList.length;
  const nextUp = checkedInList[0] || confirmedList[0];

  const remainingCount = useMemo(
    () => appointments.filter((a) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status)).length,
    [appointments],
  );

  // Full ordered queue for active/today display
  const orderedQueue = useMemo(
    () => [
      ...(activeAppt ? [activeAppt] : []),
      ...checkedInList,
      ...confirmedList,
      ...completedList,
      ...otherList,
    ],
    [activeAppt, checkedInList, confirmedList, completedList, otherList],
  );

  // Filtered queue based on dropdown selection & search query
  const filteredQueue = useMemo(() => {
    let list = orderedQueue;
    if (filterStatus !== 'ALL') {
      if (filterStatus === 'IN_CONSULTATION') {
        list = list.filter((a) => a.status === 'IN_CONSULTATION');
      } else if (filterStatus === 'CHECKED_IN') {
        list = list.filter((a) => a.status === 'CHECKED_IN');
      } else if (filterStatus === 'CONFIRMED') {
        list = list.filter((a) => a.status === 'CONFIRMED');
      } else if (filterStatus === 'COMPLETED') {
        list = list.filter((a) => a.status === 'COMPLETED');
      } else if (filterStatus === 'NO_SHOW') {
        list = list.filter((a) => a.status === 'NO_SHOW' || a.status === 'CANCELLED');
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.patient?.fullName && a.patient.fullName.toLowerCase().includes(q)) ||
          (a.tokenNumber != null && a.tokenNumber.toString().includes(q)) ||
          (a.patient?.phone && a.patient.phone.includes(q)),
      );
    }

    return list;
  }, [orderedQueue, filterStatus, searchQuery]);

  // Formatted date string e.g. "17 Nov 2026"
  const formattedDateStr = useMemo(() => {
    try {
      const parts = activeDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return activeDate;
    } catch {
      return activeDate;
    }
  }, [activeDate]);

  const formatAgeGender = (patient?: Appointment['patient']) => {
    const parts: string[] = [];
    if (patient?.age != null) parts.push(`${patient.age} yrs`);
    if (patient?.gender) {
      const g = patient.gender.toLowerCase();
      parts.push(g.charAt(0).toUpperCase() + g.slice(1));
    }
    return parts.length > 0 ? parts.join(' • ') : '—';
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* ── 1. Top Header Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-[#0066cc] flex items-center justify-center shrink-0 shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Doctor Live Queue
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Live real-time view of patient queue, active consultation, and medical prescriptions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:justify-end">
            {/* Time & Date Display */}
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              {currentTime || '11:30 AM'} • {formattedDateStr}
            </span>

            {/* Smooth Date Picker for Doctor Navigation */}
            <SmoothDatePicker
              value={activeDate}
              onChange={handleDateChange}
              className="py-1 px-2.5 text-xs font-semibold shadow-xs"
            />

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 h-8 w-8 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 shadow-xs cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* ── Main Two-Column Layout: Left (Cabin + Next + Queue Table) & Right (Shift Telemetry 4 Metrics) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT COLUMN (8 cols): Primary Clinical Flow ── */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Doctor Cabin Card (Now Serving or Cabin Idle) */}
            {activeAppt ? (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50/80 via-sky-50/40 to-blue-50/60 border border-blue-200/70 p-6 sm:p-7 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5 sm:gap-6 min-w-0">
                    {/* Circular White Token Badge */}
                    <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-[#0066cc] shadow-[0_8px_25px_rgba(0,102,204,0.12)] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] sm:text-[11px] font-bold text-[#0066cc] uppercase tracking-wider">
                        TOKEN
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-[#0066cc] leading-tight mt-0.5">
                        #{activeAppt.tokenNumber != null ? activeAppt.tokenNumber : '—'}
                      </span>
                    </div>

                    {/* Patient Details */}
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                        {activeAppt.patient?.fullName || 'Patient'}
                      </h2>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-medium flex-wrap">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          {formatTime(activeAppt.startTime)} – {formatTime(activeAppt.endTime)}
                        </span>
                        {activeAppt.patient?.age && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span>{activeAppt.patient.age} yrs</span>
                          </>
                        )}
                        {activeAppt.patient?.gender && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="uppercase">{activeAppt.patient.gender}</span>
                          </>
                        )}
                      </div>

                      <div className="pt-1.5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-blue-200 text-[#0066cc] text-xs font-semibold shadow-2xs">
                          <Stethoscope className="w-3.5 h-3.5 text-[#0066cc]" />
                          <span>Consultation Room 1</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Prescription Action Only (Doctor Clinical Work) */}
                  <div className="flex items-center shrink-0">
                    <Button
                      onClick={() => setPrescriptionAppt(activeAppt)}
                      className="h-10 px-5 rounded-2xl bg-[#0066cc] hover:bg-[#0052a3] text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Write / Edit Rx</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-50 via-blue-50/20 to-slate-50 border border-slate-200/80 p-6 sm:p-7 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5 sm:gap-6 min-w-0">
                    <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full bg-white border-2 border-slate-300 shadow-2xs flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        CABIN
                      </span>
                      <span className="text-lg sm:text-xl font-black text-slate-500 leading-tight mt-0.5">
                        IDLE
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                        Doctor Cabin Ready
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">
                        {waitingCount > 0
                          ? `${waitingCount} patient(s) waiting in clinic. Receptionist will call next patient in.`
                          : stillArrivingCount > 0
                            ? `${stillArrivingCount} patient(s) confirmed today. Awaiting check-in.`
                            : 'All patient consultations completed for this date.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Next Patient Bar */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap min-w-0">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-800 shrink-0">
                  <span>Next Patient</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                </div>

                {nextUp ? (
                  <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap min-w-0">
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-[#0066cc] font-black text-sm shrink-0">
                      #{nextUp.tokenNumber != null ? nextUp.tokenNumber : '—'}
                    </span>

                    <span className="font-extrabold text-slate-900 text-base sm:text-lg truncate">
                      {nextUp.patient?.fullName || 'Patient'}
                    </span>

                    <span className="text-slate-300 text-xs hidden sm:inline">•</span>

                    <span className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {formatTime(nextUp.startTime)} – {formatTime(nextUp.endTime)}
                      </span>
                    </span>

                    {nextUp.patient?.age && (
                      <>
                        <span className="text-slate-300 text-xs hidden sm:inline">•</span>
                        <span className="text-xs sm:text-sm text-slate-600 font-medium whitespace-nowrap">
                          {nextUp.patient.age} yrs
                        </span>
                      </>
                    )}

                    {nextUp.patient?.gender && (
                      <>
                        <span className="text-slate-300 text-xs hidden sm:inline">•</span>
                        <span className="text-xs sm:text-sm text-slate-600 font-medium uppercase whitespace-nowrap">
                          {nextUp.patient.gender}
                        </span>
                      </>
                    )}

                    {nextUp.status === 'CHECKED_IN' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Waiting in clinic
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-500 border border-slate-200 shrink-0">
                        Awaiting arrival
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-500 font-medium">
                    No upcoming patients remaining in queue
                  </span>
                )}
              </div>
            </div>

            {/* 3. Queue List Table Card */}
            <Card className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden p-0">
              {/* Card Header with Filter & Search */}
              <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 gap-3">
                <div className="flex items-center gap-2.5">
                  <List className="w-5 h-5 text-slate-700" />
                  <h3 className="text-base font-extrabold text-slate-900">Queue List</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold tabular-nums">
                    {filteredQueue.length}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                  {/* Search Input */}
                  <div className="relative min-w-[170px] sm:min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search patient, token..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 outline-none focus:border-[#0066cc] focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* Status Filter Dropdown */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <option value="ALL">All Tokens</option>
                    <option value="IN_CONSULTATION">In Progress</option>
                    <option value="CHECKED_IN">Waiting</option>
                    <option value="CONFIRMED">Expected</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="NO_SHOW">No Show</option>
                  </select>
                </div>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-5 sm:px-6">Token</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Age / Gender</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-5 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-xs font-medium">
                          No patients found for this view.
                        </td>
                      </tr>
                    ) : (
                      filteredQueue.map((appt, idx) => {
                        const isConsulting = appt.status === 'IN_CONSULTATION';
                        const isCheckedIn = appt.status === 'CHECKED_IN';
                        const isCompleted = appt.status === 'COMPLETED';
                        const isNoShow = appt.status === 'NO_SHOW';
                        const isCancelled = appt.status === 'CANCELLED';
                        const isConfirmed = appt.status === 'CONFIRMED';

                        return (
                          <tr
                            key={appt.id}
                            className={cn(
                              'hover:bg-slate-50/60 transition-colors',
                              isConsulting && 'bg-blue-50/30',
                            )}
                          >
                            {/* Token Badge */}
                            <td className="py-3.5 px-5 sm:px-6 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-[#0066cc] font-black text-xs inline-block text-center min-w-[34px]">
                                #{appt.tokenNumber != null ? appt.tokenNumber : idx + 1}
                              </span>
                            </td>

                            {/* Patient Name */}
                            <td className="py-3.5 px-4 font-bold text-slate-900 text-sm whitespace-nowrap">
                              {appt.patient?.fullName || 'Patient'}
                            </td>

                            {/* Age / Gender */}
                            <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {formatAgeGender(appt.patient)}
                            </td>

                            {/* Slot Time */}
                            <td className="py-3.5 px-4 text-xs text-slate-600 font-medium whitespace-nowrap">
                              {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                            </td>

                            {/* Status Pill Badge */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {isConsulting && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#0066cc] text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] animate-pulse" />
                                  In Progress
                                </span>
                              )}
                              {isCheckedIn && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                  Waiting
                                </span>
                              )}
                              {isConfirmed && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                  Expected
                                </span>
                              )}
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Completed
                                </span>
                              )}
                              {isNoShow && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  No Show
                                </span>
                              )}
                              {isCancelled && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                  Cancelled
                                </span>
                              )}
                            </td>

                            {/* Action Column */}
                            <td className="py-3.5 px-5 sm:px-6 text-right whitespace-nowrap">
                              {/* Prescription Button: ONLY for In Progress or Completed */}
                              {(isConsulting || isCompleted) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPrescriptionAppt(appt)}
                                  className="h-7 px-2.5 rounded-lg border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#0066cc] text-xs font-bold gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#0066cc]" />
                                  <span>Rx</span>
                                </Button>
                              )}

                              {/* Expected notice */}
                              {isConfirmed && (
                                <span className="text-[11px] text-slate-400 font-medium">
                                  Awaiting Check-in
                                </span>
                              )}

                              {/* No Show / Cancelled */}
                              {(isNoShow || isCancelled) && (
                                <span className="text-xs text-slate-300 font-medium">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* ── RIGHT COLUMN (4 cols): Remaining, Done & Total ── */}
          <div className="lg:col-span-4 space-y-3.5 lg:sticky lg:top-6">
            {/* 1. Remaining Patients Card */}
            <Card className="bg-white rounded-3xl border border-amber-100/90 p-5 sm:p-6 shadow-xs bg-gradient-to-br from-white via-amber-50/20 to-orange-50/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <Hourglass className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-amber-900 uppercase tracking-wider block">
                      Remaining
                    </span>
                    <span className="text-[11px] text-amber-700 font-medium truncate block mt-0.5">
                      {waitingCount} in clinic • {stillArrivingCount} expected
                    </span>
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 tabular-nums leading-none pl-3">
                  {remainingCount}
                </div>
              </div>
            </Card>

            {/* 2. Completed Today & Total Patients (2-Column Grid) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Completed Today (Done) */}
              <Card className="bg-white rounded-3xl border border-emerald-100/90 p-4 sm:p-5 shadow-xs bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">Done</span>
                  <div className="w-7 h-7 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums leading-none">
                  {completedList.length}
                </div>
                <span className="text-[11px] text-emerald-700 font-medium mt-1.5 block">
                  Completed today
                </span>
              </Card>

              {/* Total Patients */}
              <Card className="bg-white rounded-3xl border border-blue-100/90 p-4 sm:p-5 shadow-xs bg-gradient-to-br from-white via-blue-50/20 to-sky-50/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-blue-800 uppercase tracking-wider">Total</span>
                  <div className="w-7 h-7 rounded-xl bg-blue-100/80 text-[#0066cc] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums leading-none">
                  {appointments.length}
                </div>
                <span className="text-[11px] text-[#0066cc] font-medium mt-1.5 block">
                  Booked today
                </span>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Doctor Medical Prescription Modal ── */}
      <DoctorPrescriptionModal
        isOpen={Boolean(prescriptionAppt)}
        onClose={() => setPrescriptionAppt(null)}
        appointment={prescriptionAppt}
        onPrescriptionSaved={() => {
          toast.success('Prescription generated successfully');
          fetchAppointments(activeDate);
        }}
      />
    </div>
  );
}
