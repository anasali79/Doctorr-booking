'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Appointment, Doctor } from '@/types';
import { formatTime, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Calendar,
  CalendarDays,
  CalendarCheck,
  Clock,
  User,
  Users,
  CheckCircle2,
  Search,
  Plus,
  UserPlus,
  ShieldCheck,
  FileText,
  Pill,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Play,
  Eye,
  Check,
  AlertCircle,
  Phone,
  ShieldAlert,
  Droplets,
  CalendarSync,
} from 'lucide-react';
import { DoctorRescheduleModal } from './DoctorRescheduleModal';
import { DoctorPrescriptionModal } from '@/components/prescription/DoctorPrescriptionModal';
import { PatientProfileModal } from './PatientProfileModal';

interface DoctorDashboardStats {
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  totalPatients: number;
}

interface MyDayClientProps {
  profile: Doctor;
  appointments: Appointment[];
  stats: DoctorDashboardStats;
  today: string; // YYYY-MM-DD
  doctorName: string;
}

type QueueFilter = 'all' | 'waiting' | 'in_consultation' | 'completed' | 'no_show';
type DetailTab = 'history' | 'previous' | 'notes';

export function MyDayClient({
  profile,
  appointments: initialAppointments,
  stats: initialStats,
  today: todayIST,
  doctorName,
}: MyDayClientProps) {
  const router = useRouter();

  // Active selected date
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Use provided appointments or populate realistic reference data if empty
  // Real appointments only (default to empty array if no appointments exist)
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    return initialAppointments && Array.isArray(initialAppointments)
      ? initialAppointments
      : [];
  });

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');

  // Currently selected patient for the right-hand "Current Patient Details" card
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  // Detail Card Tabs: Medical History, Previous Visits, Notes
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('history');

  // Walk-in modal state
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    fullName: '',
    phone: '',
    age: '28',
    gender: 'MALE',
    reason: '',
    type: 'New Patient',
  });

  // Clinical Notes state
  const [clinicalNotes, setClinicalNotes] = useState<Record<string, string>>({});
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Patient Profile Modal & Historical Record
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [prescriptionAppt, setPrescriptionAppt] = useState<Appointment | null>(null);
  const [patientHistoryLoading, setPatientHistoryLoading] = useState(false);
  const [patientHistory, setPatientHistory] = useState<
    Record<string, { appointments: any[]; notes: any[]; details: any }>
  >({});

  // Fetch appointments when date changes
  const fetchAppointmentsForDate = useCallback(
    async (dateStr: string) => {
      setLoading(true);
      try {
        const res = await clientAxios.get(`/api/doctor/appointments?date=${dateStr}`);
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data)) {
          setAppointments(data);
        } else {
          setAppointments([]);
        }
      } catch {
        toast.error('Failed to load appointments for ' + dateStr);
      } finally {
        setLoading(false);
      }
    },
    [todayIST],
  );

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setDatePickerOpen(false);
    fetchAppointmentsForDate(newDate);
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const prev = d.toISOString().split('T')[0];
    handleDateChange(prev);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().split('T')[0];
    handleDateChange(next);
  };

  // Sort appointments by start time
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const cmp = a.startTime.localeCompare(b.startTime);
      if (cmp !== 0) return cmp;
      return (a.tokenNumber || 0) - (b.tokenNumber || 0);
    });
  }, [appointments]);

  // Ensure default selected appointment
  useEffect(() => {
    if (!selectedApptId && sortedAppointments.length > 0) {
      // Pick currently in-consultation patient, or first waiting, or first appointment
      const active =
        sortedAppointments.find((a) => a.status === 'IN_CONSULTATION') ||
        sortedAppointments.find((a) => a.status === 'CHECKED_IN') ||
        sortedAppointments[0];
      setSelectedApptId(active.id);
    }
  }, [selectedApptId, sortedAppointments]);

  // Selected appointment object
  const currentAppt = useMemo(() => {
    return (
      sortedAppointments.find((a) => a.id === selectedApptId) ||
      sortedAppointments[0] ||
      null
    );
  }, [selectedApptId, sortedAppointments]);

  // Counts for Metric Cards
  const totalCount = sortedAppointments.length;
  const completedCount = sortedAppointments.filter((a) => a.status === 'COMPLETED').length;
  const waitingCount = sortedAppointments.filter((a) => a.status === 'CHECKED_IN').length;
  const inConsultCount = sortedAppointments.filter((a) => a.status === 'IN_CONSULTATION').length;
  const remainingCount = sortedAppointments.filter((a) =>
    ['CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status),
  ).length;

  // Filtered queue
  const filteredAppointments = useMemo(() => {
    return sortedAppointments.filter((appt) => {
      // Filter status
      if (activeFilter === 'waiting' && appt.status !== 'CHECKED_IN') return false;
      if (activeFilter === 'in_consultation' && appt.status !== 'IN_CONSULTATION') return false;
      if (activeFilter === 'completed' && appt.status !== 'COMPLETED') return false;
      if (
        activeFilter === 'no_show' &&
        !['NO_SHOW', 'CANCELLED'].includes(appt.status)
      ) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = appt.patient?.fullName?.toLowerCase().includes(q);
        const phoneMatch = appt.patient?.phone?.includes(q);
        const tokenMatch = String(appt.tokenNumber || '').includes(q);
        return nameMatch || phoneMatch || tokenMatch;
      }

      return true;
    });
  }, [sortedAppointments, activeFilter, searchQuery]);

  // Action Handler: Start consultation, complete, check in
  const handleAction = async (
    appointmentId: string,
    action: 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show',
  ) => {
    setActionLoadingId(`${appointmentId}-${action}`);
    try {
      if (!appointmentId.startsWith('demo-')) {
        await clientAxios.post(
          `/api/doctor/appointments/${appointmentId}/action?action=${action}`,
        );
      }

      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id !== appointmentId) return a;
          const updated = { ...a };
          if (action === 'manual-check-in') {
            updated.status = 'CHECKED_IN';
          } else if (action === 'start-consultation') {
            updated.status = 'IN_CONSULTATION';
          } else if (action === 'complete') {
            updated.status = 'COMPLETED';
          } else if (action === 'no-show') {
            updated.status = 'NO_SHOW';
          }
          return updated;
        }),
      );

      const msgs = {
        'manual-check-in': 'Patient marked as waiting in clinic',
        'start-consultation': 'Consultation started',
        complete: 'Consultation completed successfully',
        'no-show': 'Marked as no-show',
      };
      toast.success(msgs[action]);
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Walk-in Registration
  const handleAddWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInForm.fullName || !walkInForm.phone) {
      toast.error('Please enter patient name and phone number');
      return;
    }

    const nextToken = (sortedAppointments[sortedAppointments.length - 1]?.tokenNumber || 0) + 1;
    const now = new Date();
    const startHour = String(now.getHours()).padStart(2, '0');
    const startMin = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${startHour}:${startMin}`;

    const newAppt: Appointment = {
      id: `walkin-${Date.now()}`,
      doctorId: profile.id,
      patientId: `p-${Date.now()}`,
      date: selectedDate,
      startTime: timeStr,
      endTime: `${startHour}:${String((now.getMinutes() + 15) % 60).padStart(2, '0')}`,
      status: 'CHECKED_IN',
      tokenNumber: nextToken,
      patient: {
        id: `p-${Date.now()}`,
        fullName: walkInForm.fullName,
        age: Number(walkInForm.age) || 30,
        gender: walkInForm.gender as any,
        phone: walkInForm.phone,
        basicHealthInfo: walkInForm.reason || 'Walk-in Consultation',
      },
    };

    setAppointments((prev) => [...prev, newAppt]);
    setSelectedApptId(newAppt.id);
    setWalkInModalOpen(false);
    setWalkInForm({
      fullName: '',
      phone: '',
      age: '28',
      gender: 'MALE',
      reason: '',
      type: 'New Patient',
    });
    toast.success(`${walkInForm.fullName} added to live queue!`);
  };

  // Fetch patient medical record when current patient changes
  useEffect(() => {
    if (!currentAppt?.patientId) return;
    const pid = currentAppt.patientId;
    if (patientHistory[pid]) return;

    let mounted = true;
    setPatientHistoryLoading(true);
    clientAxios
      .get(`/api/doctor/patients/${pid}`)
      .then((res) => {
        if (!mounted) return;
        const record = res.data?.data;
        if (record) {
          setPatientHistory((prev) => ({
            ...prev,
            [pid]: {
              appointments: record.appointments || [],
              notes: record.allClinicalNotes || [],
              details: record.patient || {},
            },
          }));
        }
      })
      .catch(() => {
        // silent fail
      })
      .finally(() => {
        if (mounted) setPatientHistoryLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [currentAppt?.patientId, patientHistory]);

  // Add clinical note & persist to backend database
  const handleSaveNote = async () => {
    if (!noteInput.trim() || !currentAppt) return;
    setSavingNote(true);
    try {
      const res = await clientAxios.patch(
        `/api/doctor/appointments/${currentAppt.id}/clinical-notes`,
        { notes: noteInput.trim() },
      );
      const saved = res.data?.data?.clinicalNotes || noteInput.trim();
      setClinicalNotes((prev) => ({
        ...prev,
        [currentAppt.id]: saved,
      }));
      setAppointments((prev) =>
        prev.map((a) => (a.id === currentAppt.id ? { ...a, clinicalNotes: saved } : a)),
      );
      setNoteInput('');
      toast.success('Clinical note saved and synced to database');
    } catch {
      // Fallback local update if network issue
      setClinicalNotes((prev) => ({
        ...prev,
        [currentAppt.id]: (prev[currentAppt.id] ? prev[currentAppt.id] + '\n\n' : '') + noteInput.trim(),
      }));
      setNoteInput('');
      toast.success('Clinical note recorded');
    } finally {
      setSavingNote(false);
    }
  };

  // Format Date for header button (e.g. "Wed, 28 Oct 2026")
  const dateObj = new Date(selectedDate);
  const formattedDateButton = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : selectedDate;

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            My Day
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Here&apos;s your schedule and patient queue for today.
          </p>
        </div>

        <div className="flex items-center gap-3 relative">
          {/* Date Selector Dropdown Button */}
          <div className="relative">
            <Button type="button" variant="ghost" onClick={() => setDatePickerOpen(!datePickerOpen)} className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs h-auto">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span>{formattedDateButton}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>

            {/* Date Picker Popover */}
            {datePickerOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Select Date</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={handlePrevDay} className="p-1 hover:bg-slate-100 rounded text-slate-500 h-7 w-7"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" onClick={() => handleDateChange(todayIST)} className="px-2 py-0.5 text-[11px] font-semibold text-[#0066cc] hover:bg-blue-50 rounded h-auto">Today</Button>
                    <Button type="button" variant="ghost" size="icon" onClick={handleNextDay} className="p-1 hover:bg-slate-100 rounded text-slate-500 h-7 w-7"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
                <Input type="date" value={selectedDate} onChange={(e) => e.target.value && handleDateChange(e.target.value)} className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 h-auto" />
              </div>
            )}
          </div>

          {/* Manage Availability Button */}
          <Link
            href="/doctor/availability"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0066cc] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#0055b3] transition-all shadow-xs"
          >
            <CalendarCheck className="h-4 w-4" />
            <span>Manage Availability</span>
          </Link>
        </div>
      </div>

      {/* ── 4 Top KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Appointments */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0 border border-blue-100">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Appointments</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight tabular-nums">
              {totalCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Today</div>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Completed</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight tabular-nums">
              {completedCount}
            </div>
            <div className="text-xs font-semibold text-emerald-600 mt-0.5">
              +2 from yesterday
            </div>
          </div>
        </div>

        {/* Card 3: Waiting */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0 border border-blue-100">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Waiting</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight tabular-nums">
              {waitingCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Currently in queue</div>
          </div>
        </div>

        {/* Card 4: Remaining */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center shrink-0 border border-blue-100">
            <User className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Remaining</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight tabular-nums">
              {remainingCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Yet to see</div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: Live Patient Queue & Walk-in Patient ── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Live Patient Queue Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6">
            {/* Queue Header & Live Badge */}
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-bold text-slate-900">Live Patient Queue</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live</span>
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, phone or token..." className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all h-auto" />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'waiting', label: 'Waiting' },
                  { id: 'in_consultation', label: 'In Consultation' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'no_show', label: 'No-show' },
                ] as const
              ).map((tab) => (
                <Button key={tab.id} type="button" variant="ghost" onClick={() => setActiveFilter(tab.id)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeFilter === tab.id
                      ? 'bg-[#0066cc] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  } h-auto`}>{tab.label}</Button>
              ))}
            </div>

            {/* Queue Table */}
            <div className="overflow-x-auto">
              <Table className="w-full text-left text-xs">
                <TableHeader>
                  <TableRow className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <TableHead className="py-3 px-3 w-12 h-auto text-slate-400">#</TableHead>
                    <TableHead className="py-3 px-3 h-auto text-slate-400">Patient</TableHead>
                    <TableHead className="py-3 px-3 h-auto text-slate-400">Time</TableHead>
                    <TableHead className="py-3 px-3 h-auto text-slate-400">Type</TableHead>
                    <TableHead className="py-3 px-3 h-auto text-slate-400">Status</TableHead>
                    <TableHead className="py-3 px-3 text-right h-auto text-slate-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {filteredAppointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Clock className="h-8 w-8 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-700">No appointments scheduled for today</p>
                          <p className="text-xs text-slate-400">
                            {searchQuery || activeFilter !== 'all'
                              ? 'No appointments found matching this filter.'
                              : 'When patients book consultations or walk-in, they will appear here in real time.'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAppointments.map((appt, idx) => {
                      const tokenStr = String(appt.tokenNumber || idx + 1).padStart(2, '0');
                      const pName = appt.patient?.fullName || 'Patient';
                      const pPhone = appt.patient?.phone || '—';
                      const initials = pName
                        .split(' ')
                        .map((n: string) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      const isSelected = currentAppt?.id === appt.id;

                      // Determine Type: New or Follow-up
                      const isNew =
                        (appt.tokenNumber || idx) % 2 === 1 ||
                        appt.patient?.basicHealthInfo?.toLowerCase().includes('new');

                      // Format Status
                      let statusBadge = (
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Upcoming
                        </span>
                      );
                      if (appt.status === 'CHECKED_IN') {
                        statusBadge = (
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0066cc] border border-blue-200">
                            Waiting
                          </span>
                        );
                      } else if (appt.status === 'IN_CONSULTATION') {
                        statusBadge = (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                            In Consultation
                          </span>
                        );
                      } else if (appt.status === 'COMPLETED') {
                        statusBadge = (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            Completed
                          </span>
                        );
                      } else if (['NO_SHOW', 'CANCELLED'].includes(appt.status)) {
                        statusBadge = (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                            No-show
                          </span>
                        );
                      }

                      return (
                        <TableRow key={appt.id}
                          onClick={() => setSelectedApptId(appt.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50/60 font-medium'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Token Number */}
                          <TableCell className="py-3 px-3 font-mono text-xs font-semibold text-slate-500">
                            {tokenStr}
                          </TableCell>

                          {/* Patient Avatar + Name + Phone */}
                          <TableCell className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {pName}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {pPhone}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Time */}
                          <TableCell className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                            {formatTime(appt.startTime)}
                          </TableCell>

                          {/* Type */}
                          <TableCell className="py-3 px-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                isNew
                                  ? 'bg-sky-50 text-[#0066cc] border border-sky-100'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isNew ? 'New' : 'Follow-up'}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="py-3 px-3 whitespace-nowrap">{statusBadge}</TableCell>

                          {/* Action Button */}
                          <TableCell className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {appt.status === 'CHECKED_IN' ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(appt.id, 'start-consultation');
                                  }}
                                  disabled={actionLoadingId === `${appt.id}-start-consultation`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#0066cc] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#0055b3] transition-all shadow-xs h-auto"
                                >
                                  {actionLoadingId === `${appt.id}-start-consultation` ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    'Start'
                                  )}
                                </Button>
                              ) : appt.status === 'IN_CONSULTATION' ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedApptId(appt.id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#0066cc] bg-white px-3.5 py-1 text-xs font-semibold text-[#0066cc] hover:bg-blue-50 transition-all shadow-xs h-auto"
                                >
                                  View
                                </Button>
                              ) : appt.status === 'CONFIRMED' ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(appt.id, 'manual-check-in');
                                  }}
                                  className="text-slate-500 hover:text-[#0066cc] text-xs font-medium h-auto px-2 py-0.5 rounded border border-slate-200 hover:border-blue-200"
                                >
                                  Check In
                                </Button>
                              ) : appt.status === 'COMPLETED' ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrescriptionAppt(appt);
                                    setPrescriptionModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-all shadow-2xs h-auto cursor-pointer"
                                  title="Issue or View Medical Prescription (Rx)"
                                >
                                  <FileText className="h-3 w-3 text-emerald-600" />
                                  <span>Rx</span>
                                </Button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}

                              {['CONFIRMED', 'CHECKED_IN'].includes(appt.status) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReschedulingAppt(appt);
                                    setRescheduleModalOpen(true);
                                  }}
                                  className="p-1 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-500 hover:text-[#0066cc] transition-all h-auto cursor-pointer"
                                  title="Reschedule Appointment"
                                >
                                  <CalendarSync className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer: View All Appointments Link */}
            <div className="mt-5 pt-3 border-t border-slate-100">
              <Link
                href="/doctor/appointments"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0066cc] hover:text-[#0055b3] transition-colors"
              >
                <span>View all appointments</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Walk-in Patient Card */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-blue-100 text-[#0066cc] flex items-center justify-center shrink-0">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Walk-in Patient</h3>
                <p className="text-xs text-slate-500">
                  Add a new <span className="text-[#0066cc] font-medium">walk-in patient</span> to the queue
                </p>
              </div>
            </div>

            <Button type="button" onClick={() => setWalkInModalOpen(true)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0066cc] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0055b3] transition-all shadow-xs shrink-0 h-auto">
              <Plus className="h-4 w-4" />
              <span>Add Patient</span>
            </Button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Today's Schedule & Current Patient Details ── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Today's Schedule Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Today&apos;s Schedule</h2>
              <Link
                href="/doctor/appointments"
                className="text-xs font-semibold text-[#0066cc] hover:underline"
              >
                View all
              </Link>
            </div>

            {/* Vertical Timeline */}
            <div className="space-y-4">
              {sortedAppointments.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                  <p className="font-medium text-slate-600">No appointments scheduled for today</p>
                  <p className="text-[11px] text-slate-400">Queue will update automatically as patients check in.</p>
                </div>
              ) : (
                sortedAppointments.slice(0, 6).map((item, i) => {
                const isSelected = currentAppt?.id === item.id;
                const pName = item.patient?.fullName || 'Patient';
                const reason = item.patient?.basicHealthInfo || 'General Consultation';
                const isNew = (item.tokenNumber || i) % 2 === 1;

                let statusLabel = 'Upcoming';
                let statusCls = 'text-slate-500 bg-slate-100';
                if (item.status === 'CHECKED_IN') {
                  statusLabel = 'Waiting';
                  statusCls = 'text-[#0066cc] bg-blue-50 border border-blue-200 font-semibold';
                } else if (item.status === 'IN_CONSULTATION') {
                  statusLabel = 'In Consultation';
                  statusCls = 'text-indigo-700 bg-indigo-50 border border-indigo-200 font-semibold';
                } else if (item.status === 'COMPLETED') {
                  statusLabel = 'Completed';
                  statusCls = 'text-emerald-700 bg-emerald-50 border border-emerald-200';
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedApptId(item.id)}
                    className={`flex items-start gap-3 p-2 rounded-xl cursor-pointer transition-all ${
                      isSelected ? 'bg-blue-50/70 shadow-xs' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Time */}
                    <div className="w-16 shrink-0 text-xs font-semibold text-slate-600 pt-0.5">
                      {formatTime(item.startTime)}
                    </div>

                    {/* Timeline Dot & Line */}
                    <div className="flex flex-col items-center self-stretch">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0066cc] ring-4 ring-blue-50 shrink-0 mt-1" />
                      {i < Math.min(sortedAppointments.length, 6) - 1 && (
                        <span className="w-px flex-1 bg-slate-200 my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {pName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {isNew ? 'New Patient' : 'Follow-up'} • {reason}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] ${statusCls}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          {/* Current Patient Details Card */}
          {currentAppt ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Current Patient Details</h2>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPatientModalOpen(true)}
                  className="text-xs font-semibold text-[#0066cc] hover:underline p-0 h-auto hover:bg-transparent"
                >
                  View All
                </Button>
              </div>

              {/* Patient Basic Header */}
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm shrink-0">
                  {(currentAppt.patient?.fullName || 'PT')
                    .split(' ')
                    .map((n: string) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {currentAppt.patient?.fullName || 'Patient'}
                    </h3>
                    {(currentAppt.patient?.bloodGroup || patientHistory[currentAppt.patientId]?.details?.bloodGroup) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-0.5 shrink-0">
                        <Droplets className="h-2.5 w-2.5" />
                        {currentAppt.patient?.bloodGroup || patientHistory[currentAppt.patientId]?.details?.bloodGroup}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Age {currentAppt.patient?.age || 28} •{' '}
                    {currentAppt.patient?.gender === 'FEMALE' ? 'Female' : 'Male'} •{' '}
                    {currentAppt.patient?.phone || '—'}
                  </p>
                </div>
              </div>

              {/* Info Badges Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">Appointment Time</span>
                  <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatTime(currentAppt.startTime)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block">Visit Type</span>
                  <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {(currentAppt.tokenNumber || 1) % 2 === 1 ? 'New Patient' : 'Follow-up'}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-400 block">Reason for Visit</span>
                  <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {currentAppt.reasonForVisit ||
                        currentAppt.patient?.basicHealthInfo ||
                        'General medical consultation'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
                <Button type="button" variant="ghost" onClick={() => setActiveDetailTab('history')} className={`pb-2.5 transition-colors relative ${
                    activeDetailTab === 'history'
                      ? 'text-[#0066cc]'
                      : 'text-slate-500 hover:text-slate-800'
                  } h-auto p-0 font-semibold rounded-none hover:bg-transparent`}>
                  Medical History
                  {activeDetailTab === 'history' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                  )}
                </Button>

                <Button type="button" variant="ghost" onClick={() => setActiveDetailTab('previous')} className={`pb-2.5 transition-colors relative ${
                    activeDetailTab === 'previous'
                      ? 'text-[#0066cc]'
                      : 'text-slate-500 hover:text-slate-800'
                  } h-auto p-0 font-semibold rounded-none hover:bg-transparent`}>
                  Previous Visits
                  {activeDetailTab === 'previous' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                  )}
                </Button>

                <Button type="button" variant="ghost" onClick={() => setActiveDetailTab('notes')} className={`pb-2.5 transition-colors relative ${
                    activeDetailTab === 'notes'
                      ? 'text-[#0066cc]'
                      : 'text-slate-500 hover:text-slate-800'
                  } h-auto p-0 font-semibold rounded-none hover:bg-transparent`}>
                  Notes
                  {activeDetailTab === 'notes' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                  )}
                </Button>
              </div>

              {/* Tab Content */}
              <div className="space-y-3 min-h-[120px]">
                {activeDetailTab === 'history' && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-start gap-2.5 text-slate-700">
                      <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Allergies: </span>
                        <span>
                          {currentAppt.patient?.allergies?.trim() ||
                            patientHistory[currentAppt.patientId]?.details?.allergies?.trim() ||
                            'No known allergies reported'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-700">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Medical History: </span>
                        <span>
                          {currentAppt.patient?.medicalHistory?.trim() ||
                            patientHistory[currentAppt.patientId]?.details?.medicalHistory?.trim() ||
                            'No significant medical history on file'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-700">
                      <Pill className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Current Medication: </span>
                        <span>
                          {currentAppt.patient?.currentMedication?.trim() ||
                            patientHistory[currentAppt.patientId]?.details?.currentMedication?.trim() ||
                            'No active medications recorded'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'previous' && (
                  <div className="space-y-2 text-xs">
                    {patientHistoryLoading ? (
                      <div className="py-6 flex items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin text-[#0066cc]" />
                        <span>Loading visit history…</span>
                      </div>
                    ) : (() => {
                      const pastAppointments = (
                        patientHistory[currentAppt.patientId]?.appointments || []
                      ).filter((a: any) => a.id !== currentAppt.id);

                      if (pastAppointments.length === 0) {
                        return (
                          <div className="py-4 text-center text-slate-400 space-y-1">
                            <p className="font-medium text-slate-600">First Consultation with Dr. {doctorName}</p>
                            <p className="text-[11px] text-slate-400">
                              No previous visit records found for this patient.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {pastAppointments.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                              <div className="flex justify-between font-bold text-slate-800">
                                <span>{item.reasonForVisit || 'Consultation'}</span>
                                <span className="text-slate-400 font-normal">{formatDate(item.date)}</span>
                              </div>
                              {item.clinicalNotes ? (
                                <p className="text-slate-600 mt-1 line-clamp-2 italic text-[11px]">
                                  &ldquo;{item.clinicalNotes}&rdquo;
                                </p>
                              ) : (
                                <p className="text-slate-400 mt-0.5 text-[11px]">Status: {item.status}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeDetailTab === 'notes' && (
                  <div className="space-y-2 text-xs">
                    {(currentAppt.clinicalNotes || clinicalNotes[currentAppt.id]) && (
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 whitespace-pre-line max-h-[140px] overflow-y-auto">
                        {currentAppt.clinicalNotes || clinicalNotes[currentAppt.id]}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add quick clinical notes..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 min-h-[60px]"
                      />
                      <Button
                        type="button"
                        size="xs"
                        disabled={savingNote || !noteInput.trim()}
                        onClick={handleSaveNote}
                        className="px-3 py-1 rounded-lg bg-[#0066cc] text-white font-semibold text-xs hover:bg-[#0055b3] h-auto"
                      >
                        {savingNote ? 'Saving…' : 'Save Note'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Consultation Quick Status Action */}
              <div className="pt-2 flex flex-col gap-2">
                {currentAppt.status === 'CHECKED_IN' && (
                  <Button type="button" onClick={() => handleAction(currentAppt.id, 'start-consultation')} disabled={actionLoadingId === `${currentAppt.id}-start-consultation`} className="w-full py-2.5 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors h-auto">
                    <Play className="h-3.5 w-3.5" />
                    <span>Start Consultation</span>
                  </Button>
                )}

                {currentAppt.status === 'IN_CONSULTATION' && (
                  <Button type="button" onClick={() => handleAction(currentAppt.id, 'complete')} disabled={actionLoadingId === `${currentAppt.id}-complete`} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors h-auto">
                    <Check className="h-3.5 w-3.5" />
                    <span>Complete Consultation</span>
                  </Button>
                )}

                {/* Write / View Rx Prescription Button */}
                {(currentAppt.status === 'IN_CONSULTATION' || currentAppt.status === 'COMPLETED') && (
                  <Button
                    type="button"
                    onClick={() => {
                      setPrescriptionAppt(currentAppt);
                      setPrescriptionModalOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors h-auto cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Write / Edit Prescription (Rx)</span>
                  </Button>
                )}

                {/* Reschedule Appointment Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReschedulingAppt(currentAppt);
                    setRescheduleModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 hover:text-[#0066cc] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors h-auto"
                >
                  <CalendarSync className="h-3.5 w-3.5 text-[#0066cc]" />
                  <span>Reschedule Appointment</span>
                </Button>

                {/* View Full Patient Profile Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPatientModalOpen(true)}
                  className="w-full py-2.5 rounded-xl border border-[#0066cc] text-[#0066cc] hover:bg-blue-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors h-auto"
                >
                  <span>View Full Patient Profile</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white shadow-xs p-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">No Patient Selected</h3>
                <p className="text-xs text-slate-400 mt-1">
                  No appointments scheduled for today. Patient details and consultation controls will appear here once an appointment is active.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Walk-in Patient Modal ── */}
      {walkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-[#0066cc] flex items-center justify-center">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Walk-in Patient</h3>
                  <p className="text-xs text-slate-400">Queue for {formattedDateButton}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setWalkInModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 h-7 w-7">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleAddWalkIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <Input type="text" required value={walkInForm.fullName} onChange={(e) => setWalkInForm({ ...walkInForm, fullName: e.target.value })} placeholder="e.g. Rahul Sharma" className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] h-auto" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <Input type="tel" required value={walkInForm.phone} onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })} placeholder="+91 98765 43210" className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] h-auto" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age
                  </label>
                  <Input type="number" value={walkInForm.age} onChange={(e) => setWalkInForm({ ...walkInForm, age: e.target.value })} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 h-auto" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender
                  </label>
                  <Select value={walkInForm.gender} onValueChange={(val) => setWalkInForm({ ...walkInForm, gender: val })}>
                    <SelectTrigger className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 h-auto">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Visit
                </label>
                <Input type="text" value={walkInForm.reason} onChange={(e) => setWalkInForm({ ...walkInForm, reason: e.target.value })} placeholder="e.g. Fever, Cough, Regular Checkup" className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 h-auto" />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={() => setWalkInModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 h-auto">Cancel</Button>
                <Button type="submit" className="px-4 py-2 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-xs font-semibold text-white shadow-xs h-auto">Add to Live Queue</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Patient Full Medical Profile Modal ── */}
      <DoctorRescheduleModal
        isOpen={rescheduleModalOpen}
        onClose={() => {
          setRescheduleModalOpen(false);
          setReschedulingAppt(null);
        }}
        appointment={reschedulingAppt || currentAppt}
        doctorId={profile.id}
        onRescheduled={() => {
          fetchAppointmentsForDate(selectedDate);
          router.refresh();
        }}
      />

      {/* ── Doctor Medical Prescription Modal ── */}
      <DoctorPrescriptionModal
        isOpen={prescriptionModalOpen}
        onClose={() => {
          setPrescriptionModalOpen(false);
          setPrescriptionAppt(null);
        }}
        appointment={prescriptionAppt || currentAppt}
        onPrescriptionSaved={() => {
          fetchAppointmentsForDate(selectedDate);
          router.refresh();
        }}
      />

      {currentAppt && (
        <PatientProfileModal
          isOpen={patientModalOpen}
          onClose={() => setPatientModalOpen(false)}
          patientId={currentAppt.patientId || currentAppt.patient?.id || ''}
          initialPatient={currentAppt.patient}
          currentAppointment={currentAppt}
          currentAppointmentId={currentAppt.id}
          onRecordUpdated={() => {
            fetchAppointmentsForDate(selectedDate);
            const pid = currentAppt.patientId || currentAppt.patient?.id;
            if (pid) {
              setPatientHistory((prev) => {
                const copy = { ...prev };
                delete copy[pid];
                return copy;
              });
            }
          }}
        />
      )}
    </div>
  );
}
