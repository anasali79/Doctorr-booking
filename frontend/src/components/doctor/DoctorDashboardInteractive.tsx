'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Calendar,
  Clock,
  Eye,
  Users,
  User,
  Search,
  Filter,
  Phone,
  CheckCircle,
  PlayCircle,
  CheckCheck,
  UserX,
  XCircle,
  CalendarSync,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { Appointment, AppointmentStatus } from '@/types';
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DoctorRescheduleModal } from './DoctorRescheduleModal';
import { DoctorPrescriptionModal } from '@/components/prescription/DoctorPrescriptionModal';

type StatusTab = 'ALL' | 'CONFIRMED' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
type DateFilter = 'all' | 'today' | 'upcoming';

interface DoctorDashboardInteractiveProps {
  stats: {
    today: number;
    upcoming: number;
    completed: number;
    totalPatients: number;
    cancelled?: number;
    noShow?: number;
  };
  initialAppointments: Appointment[];
  initialAllAppointments: Appointment[];
  doctorId?: string;
}

export function DoctorDashboardInteractive({
  stats,
  initialAppointments,
  initialAllAppointments,
  doctorId,
}: DoctorDashboardInteractiveProps) {
  const router = useRouter();
  const todayStr = getTodayIST();

  const [allList, setAllList] = useState<Appointment[]>(
    initialAllAppointments || initialAppointments || [],
  );
  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [prescriptionAppt, setPrescriptionAppt] = useState<Appointment | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: allList.length,
      confirmed: allList.filter(
        (a) =>
          a.status === 'CONFIRMED' ||
          a.status === 'CHECKED_IN' ||
          a.status === 'IN_CONSULTATION',
      ).length,
      pending: allList.filter((a) => a.status === 'PENDING_PAYMENT').length,
      completed: allList.filter((a) => a.status === 'COMPLETED').length,
      cancelled: allList.filter((a) => a.status === 'CANCELLED').length,
      noShow: allList.filter((a) => a.status === 'NO_SHOW').length,
    };
  }, [allList]);

  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'CONFIRMED', label: 'Confirmed', count: counts.confirmed },
    { key: 'PENDING', label: 'Pending', count: counts.pending },
    { key: 'COMPLETED', label: 'Completed', count: counts.completed },
    { key: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
    { key: 'NO_SHOW', label: 'No Show', count: counts.noShow },
  ];

  // Filtered List
  const filteredList = useMemo(() => {
    return allList.filter((appt) => {
      // 1. Status Filter
      if (activeTab === 'CONFIRMED') {
        if (
          appt.status !== 'CONFIRMED' &&
          appt.status !== 'CHECKED_IN' &&
          appt.status !== 'IN_CONSULTATION'
        ) {
          return false;
        }
      } else if (activeTab === 'PENDING') {
        if (appt.status !== 'PENDING_PAYMENT') return false;
      } else if (activeTab === 'COMPLETED') {
        if (appt.status !== 'COMPLETED') return false;
      } else if (activeTab === 'CANCELLED') {
        if (appt.status !== 'CANCELLED') return false;
      } else if (activeTab === 'NO_SHOW') {
        if (appt.status !== 'NO_SHOW') return false;
      }

      // 2. Date Filter
      if (dateFilter === 'today') {
        if (appt.date !== todayStr) return false;
      } else if (dateFilter === 'upcoming') {
        if (appt.date < todayStr || appt.status === 'CANCELLED') return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const patientName = appt.patient?.fullName?.toLowerCase() || '';
        const patientPhone = appt.patient?.phone?.toLowerCase() || '';
        const token = String(appt.tokenNumber || '');
        const dateStr = appt.date || '';
        const match =
          patientName.includes(q) ||
          patientPhone.includes(q) ||
          token.includes(q) ||
          dateStr.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allList, activeTab, dateFilter, searchQuery, todayStr]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  const scrollToTable = () => {
    const el = document.getElementById('appointments-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Card click handlers
  const handleTodayCardClick = () => {
    setDateFilter('today');
    setActiveTab('ALL');
    setCurrentPage(1);
    scrollToTable();
  };

  const handleUpcomingCardClick = () => {
    setDateFilter('upcoming');
    setActiveTab('ALL');
    setCurrentPage(1);
    scrollToTable();
  };

  const handleCompletedCardClick = () => {
    setDateFilter('all');
    setActiveTab('COMPLETED');
    setCurrentPage(1);
    scrollToTable();
  };

  const handlePatientsCardClick = () => {
    router.push('/doctor/patients');
  };

  // 4 Cards configuration
  const statCards = [
    {
      key: 'today',
      label: "Today's Consults",
      value: stats.today,
      icon: CalendarDays,
      iconBg: 'bg-blue-50',
      iconColor: 'text-[#0066cc]',
      onClick: handleTodayCardClick,
      isActive: dateFilter === 'today' && activeTab === 'ALL',
    },
    {
      key: 'upcoming',
      label: 'Upcoming Visits',
      value: stats.upcoming,
      icon: Eye,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      onClick: handleUpcomingCardClick,
      isActive: dateFilter === 'upcoming' && activeTab === 'ALL',
    },
    {
      key: 'completed',
      label: 'Completed Visits',
      value: stats.completed,
      icon: Users,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      onClick: handleCompletedCardClick,
      isActive: activeTab === 'COMPLETED' && dateFilter === 'all',
    },
    {
      key: 'patients',
      label: 'Total Patients',
      value: stats.totalPatients,
      icon: User,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      onClick: handlePatientsCardClick,
      isActive: false,
    },
  ];

  // Appointment Actions
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

      setAllList(updater);
      router.refresh();
    } catch (err: unknown) {
      toast.error('Cancel Failed', { description: extractErrorMessage(err) });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── 4 Clickable Metric Cards (No up arrow, clean bold number) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {statCards.map((item) => (
          <div
            key={item.label}
            onClick={item.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.onClick();
              }
            }}
            className={cn(
              'rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 transition-all group cursor-pointer text-left select-none',
              item.isActive
                ? 'border-2 border-[#0066cc] shadow-md -translate-y-0.5 ring-2 ring-blue-100'
                : 'border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5',
            )}
            title={`Click to view ${item.label.toLowerCase()}`}
          >
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs',
                item.iconBg,
                item.iconColor,
              )}
            >
              <item.icon className="h-5 w-5" />
            </div>

            <div className="mt-4 text-xs sm:text-sm font-semibold text-slate-600">
              {item.label}
            </div>

            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Redesigned All Appointments Card Section (Matches Reference Image) ── */}
      <div
        id="appointments-section"
        className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-[0_2px_16px_rgba(0,0,0,0.03)] space-y-5"
      >
        {/* Top Header Bar: Title on Left, Search & Filter on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Blue Calendar Icon & "All Appointments" */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0066cc] flex items-center justify-center shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                All Appointments
              </h2>
            </div>
          </div>

          {/* Right: Search Input Pill & Filter Button */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search patient, token or date..."
                className="w-60 sm:w-72 rounded-full border border-slate-200/80 bg-white pl-9.5 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={cn(
                'h-9 w-9 rounded-full border flex items-center justify-center transition-colors shadow-2xs cursor-pointer',
                showFilterDropdown || dateFilter !== 'all'
                  ? 'border-[#0066cc] bg-blue-50 text-[#0066cc]'
                  : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600',
              )}
              title="Toggle date filters"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Date Filter Dropdown Bar (Toggleable) */}
        {showFilterDropdown && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
            <span className="font-semibold text-slate-600 mr-1">Date Scope:</span>
            <button
              type="button"
              onClick={() => {
                setDateFilter('all');
                setCurrentPage(1);
              }}
              className={cn(
                'px-3.5 py-1 rounded-full font-medium transition-colors cursor-pointer',
                dateFilter === 'all'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100',
              )}
            >
              All Dates
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilter('today');
                setCurrentPage(1);
              }}
              className={cn(
                'px-3.5 py-1 rounded-full font-medium transition-colors cursor-pointer',
                dateFilter === 'today'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100',
              )}
            >
              Today Only ({allList.filter((a) => a.date === todayStr).length})
            </button>
            <button
              type="button"
              onClick={() => {
                setDateFilter('upcoming');
                setCurrentPage(1);
              }}
              className={cn(
                'px-3.5 py-1 rounded-full font-medium transition-colors cursor-pointer',
                dateFilter === 'upcoming'
                  ? 'bg-[#0066cc] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100',
              )}
            >
              Upcoming ({allList.filter((a) => a.date >= todayStr && a.status !== 'CANCELLED').length})
            </button>
            {dateFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className="ml-auto text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                Reset Date Filter
              </button>
            )}
          </div>
        )}

        {/* Filter Tabs (Exact Match to Screenshot) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer',
                  isActive
                    ? 'bg-[#0066cc] text-white shadow-xs'
                    : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 border border-slate-200/70',
                )}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {/* Active Date Filter Banner Pill */}
        {dateFilter !== 'all' && (
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-[#0066cc]">
              <span>
                Filtered by {dateFilter === 'today' ? "Today's Queue" : 'Upcoming Bookings'}
              </span>
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className="hover:text-blue-900 font-bold ml-1 cursor-pointer"
                title="Clear date filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        {/* Table / Empty State */}
        {paginatedList.length === 0 ? (
          <div className="py-14 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-[#0066cc] flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No appointments found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No records match the selected status &quot;{activeTab}&quot; or search query.
            </p>
            {(activeTab !== 'ALL' || dateFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setDateFilter('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="mt-3 text-xs font-semibold text-[#0066cc] hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 overflow-x-auto shadow-2xs w-full">
            <Table className="w-full min-w-full">
              {/* Header Columns matching exact screenshot: # Token Time Date Patient Contact Status Actions */}
              <TableHeader className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 uppercase font-bold tracking-wider text-[10px]">
                <TableRow>
                  <TableHead className="py-2.5 px-3 w-10 text-center">#</TableHead>
                  <TableHead className="py-2.5 px-3 w-14">Token</TableHead>
                  <TableHead className="py-2.5 px-3">Time</TableHead>
                  <TableHead className="py-2.5 px-3">Date</TableHead>
                  <TableHead className="py-2.5 px-3">Patient</TableHead>
                  <TableHead className="py-2.5 px-3">Contact</TableHead>
                  <TableHead className="py-2.5 px-3">Status</TableHead>
                  <TableHead className="py-2.5 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {paginatedList.map((appt, idx) => {
                  const serialNumber = (currentPage - 1) * pageSize + idx + 1;
                  const isTodayAppt = appt.date === todayStr;
                  const patient = appt.patient;

                  return (
                    <TableRow key={appt.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* # */}
                      <TableCell className="py-2.5 px-3 font-mono text-xs text-slate-400 font-medium text-center w-10">
                        {serialNumber}
                      </TableCell>

                      {/* Token */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap w-14">
                        <span className="h-7 w-7 rounded-lg bg-slate-900 text-white font-mono font-black flex items-center justify-center text-xs shadow-2xs">
                          #{String(appt.tokenNumber || serialNumber).padStart(2, '0')}
                        </span>
                      </TableCell>

                      {/* Time */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900 text-xs">
                        {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700 text-xs">
                        {isTodayAppt ? (
                          <span className="inline-flex items-center gap-1 text-[#0066cc] font-bold">
                            Today ({formatDate(appt.date)})
                          </span>
                        ) : (
                          formatDate(appt.date)
                        )}
                      </TableCell>

                      {/* Patient */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap">
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
                      <TableCell className="py-2.5 px-3 whitespace-nowrap text-slate-700 text-xs">
                        {patient?.phone ? (
                          <span className="flex items-center gap-1 font-mono font-semibold">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {patient.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap">
                        <StatusBadge status={appt.status} />
                      </TableCell>

                      {/* Actions (Compact to avoid horizontal slider/overflow) */}
                      <TableCell className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {appt.status === 'CONFIRMED' && (
                            <>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="h-7.5 w-7.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
                                    title="More options (Reschedule, No Show, Cancel)"
                                    aria-label="More options"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  sideOffset={6}
                                  className="w-48 p-1.5 rounded-2xl bg-white shadow-xl border border-slate-200/90 text-xs flex flex-col gap-0.5 z-50"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleAction(appt.id, 'no-show')}
                                    disabled={loadingId === `${appt.id}-no-show`}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-slate-100 text-slate-700 font-medium transition-colors text-left cursor-pointer"
                                  >
                                    <UserX className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Mark as No Show</span>
                                  </button>

                                  {appt.date >= todayStr && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setReschedulingAppt(appt)}
                                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-blue-50 text-blue-700 font-medium transition-colors text-left cursor-pointer"
                                      >
                                        <CalendarSync className="h-3.5 w-3.5 text-blue-600" />
                                        <span>Reschedule Visit</span>
                                      </button>

                                      <div className="h-px bg-slate-100 my-0.5" />

                                      <button
                                        type="button"
                                        onClick={() => handleCancel(appt.id)}
                                        disabled={loadingId === `${appt.id}-cancel`}
                                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-medium transition-colors text-left cursor-pointer"
                                      >
                                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                        <span>Cancel Appointment</span>
                                      </button>
                                    </>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </>
                          )}

                          {appt.status === 'CHECKED_IN' && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="h-7.5 w-7.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
                                  title="More options"
                                  aria-label="More options"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent
                                align="end"
                                sideOffset={6}
                                className="w-48 p-1.5 rounded-2xl bg-white shadow-xl border border-slate-200/90 text-xs flex flex-col gap-0.5 z-50"
                              >
                                <button
                                  type="button"
                                  onClick={() => setReschedulingAppt(appt)}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-blue-50 text-blue-700 font-medium transition-colors text-left cursor-pointer"
                                >
                                  <CalendarSync className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Reschedule Visit</span>
                                </button>
                              </PopoverContent>
                            </Popover>
                          )}

                          {appt.status === 'IN_CONSULTATION' && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleAction(appt.id, 'complete')}
                              disabled={loadingId === `${appt.id}-complete`}
                              className="btn-primary !py-1 !px-3 text-[11px] h-7.5"
                              title="Mark consultation completed"
                            >
                              {loadingId === `${appt.id}-complete` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Complete Visit</span>
                            </Button>
                          )}

                          {appt.status === 'COMPLETED' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPrescriptionAppt(appt)}
                              className="px-2.5 py-1 rounded-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs h-7.5"
                              title="Issue or View Medical Prescription"
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Prescription</span>
                            </Button>
                          )}

                          {(appt.status === 'CANCELLED' ||
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
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPage * pageSize, filteredList.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{filteredList.length}</span> appointments
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 px-2.5 rounded-xl text-xs cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                <span>Prev</span>
              </Button>

              <span className="px-2 text-xs font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-2.5 rounded-xl text-xs cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      <DoctorRescheduleModal
        isOpen={!!reschedulingAppt}
        onClose={() => setReschedulingAppt(null)}
        appointment={reschedulingAppt}
        doctorId={doctorId}
        onRescheduled={() => {
          router.refresh();
        }}
      />

      {/* Doctor Prescription Modal */}
      <DoctorPrescriptionModal
        isOpen={!!prescriptionAppt}
        onClose={() => setPrescriptionAppt(null)}
        appointment={prescriptionAppt}
        onPrescriptionSaved={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
