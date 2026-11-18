'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  Search,
  Filter,
  Phone,
  CheckCircle,
  PlayCircle,
  CheckCheck,
  UserX,
  XCircle,
  CalendarSync,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Activity,
  Users,
  Stethoscope,
  X,
  AlertCircle,
  Loader2,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Appointment } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime, formatDate, getTodayIST, cn } from '@/lib/utils';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmoothDatePicker } from '@/components/ui/smooth-date-picker';
import { SmoothTimePicker } from '@/components/ui/smooth-time-picker';

type StatusTab = 'ALL' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
type DateFilter = 'all' | 'today' | 'upcoming' | 'past' | 'custom';

export interface ReceptionistDoctorInfo {
  id: string;
  fullName: string;
  specialization: string;
  consultationFee?: number;
  phone?: string | null;
}

interface ReceptionistAppointmentsClientProps {
  initialAppointments: Appointment[];
  doctor: ReceptionistDoctorInfo | null;
  allDoctors?: ReceptionistDoctorInfo[];
  selectedDoctorId?: string;
  todayIST: string;
}

export function ReceptionistAppointmentsClient({
  initialAppointments,
  doctor,
  allDoctors = [],
  selectedDoctorId: initialSelectedDoctorId = 'all',
  todayIST,
}: ReceptionistAppointmentsClientProps) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments || []);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Doctor Selector State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialSelectedDoctorId);
  const [isDoctorSelectOpen, setIsDoctorSelectOpen] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');

  // Fallback doctors list
  const doctorList = useMemo(() => {
    if (allDoctors && allDoctors.length > 0) {
      if (doctor && !allDoctors.some((d) => d.id === doctor.id)) {
        return [doctor, ...allDoctors];
      }
      return allDoctors;
    }
    if (doctor) return [doctor];
    return [];
  }, [allDoctors, doctor]);

  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctorList;
    const q = doctorSearch.toLowerCase().trim();
    return doctorList.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q),
    );
  }, [doctorList, doctorSearch]);

  const selectedDoctorObj = useMemo(() => {
    if (selectedDoctorId === 'all') return null;
    return doctorList.find((d) => d.id === selectedDoctorId) || doctor;
  }, [doctorList, selectedDoctorId, doctor]);

  const selectedDoctorLabel = useMemo(() => {
    if (selectedDoctorId === 'all') return 'All Doctors';
    if (selectedDoctorObj) return `Dr. ${selectedDoctorObj.fullName}`;
    return 'Select Doctor';
  }, [selectedDoctorId, selectedDoctorObj]);

  // Filters state
  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDate, setCustomDate] = useState<string>(todayIST);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(todayIST);
  const [rescheduleStartTime, setRescheduleStartTime] = useState('10:00');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('10:15');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Refresh All Appointments
  const fetchAppointments = useCallback(
    async (targetDoctorId?: string | boolean, silent = false) => {
      const docId = typeof targetDoctorId === 'string' ? targetDoctorId : selectedDoctorId;
      const isSilent = typeof targetDoctorId === 'boolean' ? targetDoctorId : silent;
      if (!isSilent) setRefreshing(true);
      try {
        const query =
          docId && docId !== 'all'
            ? `?doctorId=${encodeURIComponent(docId)}`
            : docId === 'all'
            ? '?doctorId=all'
            : '';
        const res = await clientAxios.get(`/api/receptionist/appointments${query}`);
        const data = res.data?.data || [];
        setAppointments(Array.isArray(data) ? data : []);
        if (!isSilent) toast.success('Appointments updated');
      } catch {
        if (!isSilent) toast.error('Failed to load appointments');
      } finally {
        if (!isSilent) setRefreshing(false);
      }
    },
    [selectedDoctorId],
  );

  const handleSelectDoctor = (docId: string) => {
    setSelectedDoctorId(docId);
    setIsDoctorSelectOpen(false);
    fetchAppointments(docId);
    const param = docId && docId !== 'all' ? `?doctorId=${docId}` : '?doctorId=all';
    router.replace(`/receptionist/appointments${param}`, { scroll: false });
  };

  // Quick Action (Manual Check-In)
  const handleCheckIn = async (appointmentId: string) => {
    setLoadingId(appointmentId);
    try {
      await clientAxios.post(
        `/api/receptionist/appointments/${appointmentId}/action?action=manual-check-in`,
      );
      toast.success('Patient checked in to waiting room');
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId
            ? { ...a, status: 'CHECKED_IN' as any, checkedInAt: new Date().toISOString() }
            : a,
        ),
      );
    } catch (err: any) {
      toast.error(extractErrorMessage(err) || 'Check-in failed');
    } finally {
      setLoadingId(null);
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async () => {
    if (!rescheduleTarget) return;
    setRescheduling(true);
    try {
      await clientAxios.patch(`/api/receptionist/appointments/${rescheduleTarget.id}/reschedule`, {
        date: rescheduleDate,
        startTime: rescheduleStartTime,
        endTime: rescheduleEndTime,
        rescheduleReason: rescheduleReason.trim() || undefined,
      });
      toast.success(`Appointment rescheduled to ${formatDate(rescheduleDate)} at ${rescheduleStartTime}`);
      setRescheduleTarget(null);
      fetchAppointments(true);
    } catch (err: any) {
      toast.error(extractErrorMessage(err) || 'Reschedule failed');
    } finally {
      setRescheduling(false);
    }
  };

  // Submit Cancel
  const handleCancelSubmit = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await clientAxios.patch(`/api/receptionist/appointments/${cancelTarget.id}/cancel`);
      toast.success('Appointment cancelled successfully');
      setCancelTarget(null);
      setAppointments((prev) =>
        prev.map((a) => (a.id === cancelTarget.id ? { ...a, status: 'CANCELLED' as any } : a)),
      );
    } catch (err: any) {
      toast.error(extractErrorMessage(err) || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: appointments.length,
      today: appointments.filter((a) => a.date === todayIST).length,
      upcoming: appointments.filter((a) => a.date >= todayIST && a.status !== 'CANCELLED').length,
      completed: appointments.filter((a) => a.status === 'COMPLETED').length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
      uniquePatients: new Set(appointments.map((a) => a.patientId).filter(Boolean)).size,
    };
  }, [appointments, todayIST]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: appointments.length,
      confirmed: appointments.filter((a) => a.status === 'CONFIRMED').length,
      checkedIn: appointments.filter((a) => a.status === 'CHECKED_IN').length,
      inConsultation: appointments.filter((a) => a.status === 'IN_CONSULTATION').length,
      completed: appointments.filter((a) => a.status === 'COMPLETED').length,
      cancelled: appointments.filter((a) => a.status === 'CANCELLED').length,
      noShow: appointments.filter((a) => a.status === 'NO_SHOW').length,
    };
  }, [appointments]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      // 1. Status Filter
      if (activeTab === 'CONFIRMED' && a.status !== 'CONFIRMED') return false;
      if (activeTab === 'CHECKED_IN' && a.status !== 'CHECKED_IN') return false;
      if (activeTab === 'IN_CONSULTATION' && a.status !== 'IN_CONSULTATION') return false;
      if (activeTab === 'COMPLETED' && a.status !== 'COMPLETED') return false;
      if (activeTab === 'CANCELLED' && a.status !== 'CANCELLED') return false;
      if (activeTab === 'NO_SHOW' && a.status !== 'NO_SHOW') return false;

      // 2. Date Filter
      if (dateFilter === 'today' && a.date !== todayIST) return false;
      if (dateFilter === 'upcoming' && a.date < todayIST) return false;
      if (dateFilter === 'past' && a.date >= todayIST) return false;
      if (dateFilter === 'custom' && a.date !== customDate) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = a.patient?.fullName?.toLowerCase() || '';
        const phone = a.patient?.phone || '';
        const token = String(a.tokenNumber || '');
        const id = a.id?.toLowerCase() || '';
        if (!pName.includes(q) && !phone.includes(q) && !token.includes(q) && !id.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, activeTab, dateFilter, customDate, searchQuery, todayIST]);

  // Reset page on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, dateFilter, customDate, searchQuery]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredAppointments.length / pageSize) || 1;
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAppointments.slice(start, start + pageSize);
  }, [filteredAppointments, currentPage, pageSize]);

  return (
    <div className="space-y-6 pb-16">
      {/* ─── Hero Overview Banner ─── */}
      <div className="relative rounded-2xl sm:rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white p-6 sm:p-7 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Popover open={isDoctorSelectOpen} onOpenChange={setIsDoctorSelectOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/90 hover:bg-blue-200/80 text-[#0066cc] text-xs font-bold transition-all cursor-pointer group shadow-2xs border border-blue-200"
                  >
                    <Stethoscope className="h-3.5 w-3.5 text-[#0066cc]" />
                    <span>{selectedDoctorLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-blue-600 group-hover:translate-y-0.5 transition-transform" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[320px] p-2.5 rounded-2xl bg-white border border-slate-200 shadow-xl space-y-2 z-50"
                >
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search doctor..."
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      className="h-8.5 pl-8 pr-2 text-xs rounded-xl bg-slate-50 border-slate-200"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
                    {/* Option: All Doctors */}
                    <div
                      onClick={() => handleSelectDoctor('all')}
                      className={cn(
                        'px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors',
                        selectedDoctorId === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-slate-100 text-slate-700',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                            selectedDoctorId === 'all' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700',
                          )}
                        >
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold">All Doctors</p>
                          <p
                            className={cn(
                              'text-[10px]',
                              selectedDoctorId === 'all' ? 'text-blue-100' : 'text-slate-400',
                            )}
                          >
                            View ledger across clinic
                          </p>
                        </div>
                      </div>
                      {selectedDoctorId === 'all' && <Check className="w-4 h-4 stroke-[2.5]" />}
                    </div>

                    {/* Each Doctor */}
                    {filteredDoctors.map((doc) => {
                      const isSelected = selectedDoctorId === doc.id;
                      const initial = doc.fullName
                        ? doc.fullName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase() || 'D'
                        : 'D';

                      return (
                        <div
                          key={doc.id}
                          onClick={() => handleSelectDoctor(doc.id)}
                          className={cn(
                            'px-3 py-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'hover:bg-slate-100 text-slate-700',
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                                isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700',
                              )}
                            >
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold truncate">{doc.fullName}</p>
                              <p
                                className={cn(
                                  'text-[10px] truncate',
                                  isSelected ? 'text-blue-100' : 'text-slate-400',
                                )}
                              >
                                {doc.specialization}
                              </p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 stroke-[2.5] shrink-0 ml-2" />}
                        </div>
                      );
                    })}

                    {filteredDoctors.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-3">No matching doctors</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <span className="text-xs text-slate-500 font-medium">
                {selectedDoctorId === 'all'
                  ? `Showing all ${doctorList.length} clinic doctors`
                  : selectedDoctorObj?.specialization || 'Consultation'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              All Patient Appointments
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Complete appointment ledger across past, current, and future schedules. Manage patient check-ins, reschedules, and cancellations.
            </p>
          </div>

          {/* Quick CTA to Live Queue */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchAppointments(false)}
              disabled={refreshing}
              className="h-10 px-3.5 rounded-xl border-slate-200 text-xs font-semibold cursor-pointer bg-white hover:bg-slate-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', refreshing && 'animate-spin')} />
              <span>Refresh</span>
            </Button>

            <Link href="/receptionist/queue">
              <Button
                type="button"
                className="h-10 px-4 rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold shadow-md shadow-blue-500/20 gap-2 cursor-pointer"
              >
                <span className="relative flex h-2 w-2">
                </span>
                <Activity className="h-4 w-4" />
                <span>Go to Live Queue</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 4 Quick KPI Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Today&apos;s Bookings</span>
            <span className="p-2 rounded-xl bg-blue-50 text-[#0066cc]">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{stats.today}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Scheduled for today</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Upcoming</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{stats.upcoming}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">From today onward</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completed</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{stats.completed}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Consultations finished</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Patients</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{stats.uniquePatients}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Distinct patients served</p>
        </div>
      </div>

      {/* ─── Control Bar: Status Tabs, Date Filter, Search ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-5 space-y-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
          {(
            [
              { key: 'ALL', label: 'All', count: counts.all },
              { key: 'CONFIRMED', label: 'Confirmed', count: counts.confirmed },
              { key: 'CHECKED_IN', label: 'In Waiting Room', count: counts.checkedIn },
              { key: 'IN_CONSULTATION', label: 'In Consultation', count: counts.inConsultation },
              { key: 'COMPLETED', label: 'Completed', count: counts.completed },
              { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
              { key: 'NO_SHOW', label: 'No Show', count: counts.noShow },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                activeTab === tab.key
                  ? 'bg-blue-50 text-[#0066cc] ring-1 ring-blue-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10px] rounded-full font-semibold',
                  activeTab === tab.key
                    ? 'bg-[#0066cc] text-white'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Date Filters & Search Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Date Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: 'All Dates' },
                { key: 'today', label: 'Today' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past', label: 'Past' },
                { key: 'custom', label: 'Specific Date' },
              ] as const
            ).map((df) => (
              <button
                key={df.key}
                type="button"
                onClick={() => setDateFilter(df.key)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border',
                  dateFilter === df.key
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {df.label}
              </button>
            ))}

            {dateFilter === 'custom' && (
              <SmoothDatePicker
                value={customDate}
                onChange={(d) => setCustomDate(d)}
                className="w-36 text-xs rounded-xl"
              />
            )}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, phone, token..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Appointments Table / Cards ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {paginatedAppointments.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">No appointments found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No appointments match the selected filters or search criteria.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-16 text-xs font-bold text-slate-600">Token</TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">Patient Details</TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">Date & Slot</TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">Doctor</TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">Status</TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">Fee / Type</TableHead>
                    <TableHead className="text-right text-xs font-bold text-slate-600 pr-6">Front Desk Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAppointments.map((appt) => {
                    const isToday = appt.date === todayIST;
                    const isCheckedIn = appt.status === 'CHECKED_IN';
                    const isConfirmed = appt.status === 'CONFIRMED';
                    const isInConsult = appt.status === 'IN_CONSULTATION';
                    const isCompleted = appt.status === 'COMPLETED';

                    return (
                      <TableRow key={appt.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Token # */}
                        <TableCell className="font-bold text-slate-900">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-blue-50 text-[#0066cc] font-black text-xs border border-blue-200/80">
                            #{appt.tokenNumber || '—'}
                          </span>
                        </TableCell>

                        {/* Patient */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                              {appt.patient?.fullName?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {appt.patient?.fullName || 'Walk-in Patient'}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                {appt.patient?.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-2.5 w-2.5 text-slate-400" />
                                    <span>{appt.patient.phone}</span>
                                  </span>
                                )}
                                {appt.patient?.gender && <span>• {appt.patient.gender}</span>}
                                {appt.patient?.age && <span>• {appt.patient.age}y</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Date & Slot */}
                        <TableCell>
                          <div className="text-xs">
                            <p className={cn('font-bold', isToday ? 'text-[#0066cc]' : 'text-slate-800')}>
                              {formatDate(appt.date)} {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-[#0066cc] font-black">TODAY</span>}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                            </p>
                          </div>
                        </TableCell>

                        {/* Doctor */}
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-bold text-slate-900 truncate max-w-[140px]">
                              {appt.doctor?.fullName || selectedDoctorObj?.fullName || doctor?.fullName || 'Assigned Doctor'}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[140px]">
                              {appt.doctor?.specialization || selectedDoctorObj?.specialization || doctor?.specialization || 'Physician'}
                            </p>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusBadge status={appt.status} />
                          {appt.checkedInAt && (
                            <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 mt-1">
                              <CheckCircle className="h-3 w-3 text-amber-600" />
                              <span>In: {formatTime(appt.checkedInAt)}</span>
                            </p>
                          )}
                        </TableCell>

                        {/* Fee / Type */}
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-bold text-slate-800">
                              ₹{appt.consultationFee || doctor?.consultationFee || 500}
                            </p>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold">
                              {appt.isWalkIn ? 'Walk-in' : 'Booked Online'}
                            </p>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Check-In button if confirmed & today */}
                            {isConfirmed && isToday && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleCheckIn(appt.id)}
                                disabled={loadingId === appt.id}
                                className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs gap-1 cursor-pointer"
                              >
                                {loadingId === appt.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                                <span>Check In</span>
                              </Button>
                            )}

                            {/* Reschedule Button */}
                            {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRescheduleTarget(appt);
                                  setRescheduleDate(appt.date);
                                  setRescheduleStartTime(appt.startTime || '10:00');
                                  setRescheduleEndTime(appt.endTime || '10:15');
                                  setRescheduleReason('');
                                }}
                                className="h-7 px-2 rounded-lg border-slate-200 text-slate-700 hover:text-[#0066cc] text-[11px] font-semibold cursor-pointer"
                                title="Reschedule Appointment"
                              >
                                <CalendarSync className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Reschedule</span>
                              </Button>
                            )}

                            {/* Cancel Button */}
                            {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCancelTarget(appt)}
                                className="h-7 px-2 rounded-lg border-slate-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                                title="Cancel Appointment"
                              >
                                <XCircle className="h-3 w-3 sm:mr-1" />
                                <span className="hidden sm:inline">Cancel</span>
                              </Button>
                            )}

                            {/* View in Queue */}
                            {isToday && (isCheckedIn || isInConsult) && (
                              <Link href="/receptionist/queue">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[#0066cc] hover:bg-blue-50 text-[11px] font-bold cursor-pointer"
                                >
                                  <span>Queue</span>
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* ─── Pagination Footer ─── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="text-xs text-slate-500 font-medium">
                Showing{' '}
                <strong className="text-slate-800">
                  {Math.min((currentPage - 1) * pageSize + 1, filteredAppointments.length)}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800">
                  {Math.min(currentPage * pageSize, filteredAppointments.length)}
                </strong>{' '}
                of <strong className="text-slate-800">{filteredAppointments.length}</strong> appointments
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  <span>Prev</span>
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const hasGap = prev && page - prev > 1;

                    return (
                      <React.Fragment key={page}>
                        {hasGap && <span className="px-1 text-slate-400 text-xs font-bold">...</span>}
                        <Button
                          type="button"
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={cn(
                            'h-8 w-8 p-0 rounded-lg text-xs font-bold cursor-pointer',
                            currentPage === page
                              ? 'bg-[#0066cc] hover:bg-[#0052a3] text-white shadow-2xs'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-100',
                          )}
                        >
                          {page}
                        </Button>
                      </React.Fragment>
                    );
                  })}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Reschedule Modal ─── */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarSync className="h-4 w-4 text-[#0066cc]" />
                <h3 className="text-base font-bold text-slate-900">Reschedule Appointment</h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                Patient: {rescheduleTarget.patient?.fullName}
              </p>
              <p className="text-slate-500">
                Current Slot: {formatDate(rescheduleTarget.date)} ({rescheduleTarget.startTime} - {rescheduleTarget.endTime})
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Date
                </label>
                <SmoothDatePicker
                  value={rescheduleDate}
                  onChange={(d) => setRescheduleDate(d)}
                  className="w-full text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Time
                  </label>
                  <SmoothTimePicker
                    value={rescheduleStartTime}
                    onChange={(t) => setRescheduleStartTime(t)}
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Time
                  </label>
                  <SmoothTimePicker
                    value={rescheduleEndTime}
                    onChange={(t) => setRescheduleEndTime(t)}
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Rescheduling (Optional)
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Patient requested morning slot, doctor delayed"
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRescheduleTarget(null)}
                disabled={rescheduling}
                className="rounded-xl border-slate-200 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRescheduleSubmit}
                disabled={rescheduling}
                className="rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-bold"
              >
                {rescheduling ? 'Saving...' : 'Confirm Reschedule'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Modal ─── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">Cancel Appointment?</h3>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to cancel the appointment for{' '}
              <strong className="text-slate-900">{cancelTarget.patient?.fullName}</strong> on{' '}
              <strong className="text-slate-900">{formatDate(cancelTarget.date)}</strong>? This will release their token slot.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="rounded-xl border-slate-200 text-xs font-semibold"
              >
                No, Keep
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCancelSubmit}
                disabled={cancelling}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Appointment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
