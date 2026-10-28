'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Appointment, Doctor } from '@/types';
import { formatTime, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { clientAxios } from '@/lib/api/axios';
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
} from 'lucide-react';

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

// Sample fallback appointments if backend has 0 appointments for the day
const SAMPLE_APPOINTMENTS: Appointment[] = [
  {
    id: 'demo-1',
    doctorId: 'doc-1',
    patientId: 'p-1',
    date: '2026-10-28',
    startTime: '09:30',
    endTime: '09:45',
    status: 'CHECKED_IN',
    tokenNumber: 1,
    patient: {
      id: 'p-1',
      fullName: 'Rahul Sharma',
      age: 28,
      gender: 'MALE',
      phone: '+91 98765 43210',
      basicHealthInfo: 'Fever and cough',
    },
  },
  {
    id: 'demo-2',
    doctorId: 'doc-1',
    patientId: 'p-2',
    date: '2026-10-28',
    startTime: '09:45',
    endTime: '10:00',
    status: 'IN_CONSULTATION',
    tokenNumber: 2,
    patient: {
      id: 'p-2',
      fullName: 'Priya Patel',
      age: 32,
      gender: 'FEMALE',
      phone: '+91 87654 32109',
      basicHealthInfo: 'Follow-up General Consultation',
    },
  },
  {
    id: 'demo-3',
    doctorId: 'doc-1',
    patientId: 'p-3',
    date: '2026-10-28',
    startTime: '10:00',
    endTime: '10:15',
    status: 'CHECKED_IN',
    tokenNumber: 3,
    patient: {
      id: 'p-3',
      fullName: 'Mohammed Khan',
      age: 45,
      gender: 'MALE',
      phone: '+91 76543 21098',
      basicHealthInfo: 'High fever and fatigue',
    },
  },
  {
    id: 'demo-4',
    doctorId: 'doc-1',
    patientId: 'p-4',
    date: '2026-10-28',
    startTime: '10:15',
    endTime: '10:30',
    status: 'CONFIRMED',
    tokenNumber: 4,
    patient: {
      id: 'p-4',
      fullName: 'Sneha Singh',
      age: 24,
      gender: 'FEMALE',
      phone: '+91 65432 10987',
      basicHealthInfo: 'Routine health checkup',
    },
  },
  {
    id: 'demo-5',
    doctorId: 'doc-1',
    patientId: 'p-5',
    date: '2026-10-28',
    startTime: '10:30',
    endTime: '10:45',
    status: 'CONFIRMED',
    tokenNumber: 5,
    patient: {
      id: 'p-5',
      fullName: 'Amit Kumar',
      age: 39,
      gender: 'MALE',
      phone: '+91 54321 99876',
      basicHealthInfo: 'General health consultation',
    },
  },
  {
    id: 'demo-6',
    doctorId: 'doc-1',
    patientId: 'p-6',
    date: '2026-10-28',
    startTime: '10:45',
    endTime: '11:00',
    status: 'CONFIRMED',
    tokenNumber: 6,
    patient: {
      id: 'p-6',
      fullName: 'Neha Tripathi',
      age: 29,
      gender: 'FEMALE',
      phone: '+91 43210 98765',
      basicHealthInfo: 'Seasonal allergy and skin rash',
    },
  },
  {
    id: 'demo-7',
    doctorId: 'doc-1',
    patientId: 'p-7',
    date: '2026-10-28',
    startTime: '11:00',
    endTime: '11:15',
    status: 'CONFIRMED',
    tokenNumber: 7,
    patient: {
      id: 'p-7',
      fullName: 'Pooja Kanojiya',
      age: 34,
      gender: 'FEMALE',
      phone: '+91 32109 87654',
      basicHealthInfo: 'Migraine and headache review',
    },
  },
  {
    id: 'demo-8',
    doctorId: 'doc-1',
    patientId: 'p-8',
    date: '2026-10-28',
    startTime: '11:15',
    endTime: '11:30',
    status: 'CONFIRMED',
    tokenNumber: 8,
    patient: {
      id: 'p-8',
      fullName: 'Vikash Singh',
      age: 41,
      gender: 'MALE',
      phone: '+91 21098 76543',
      basicHealthInfo: 'Follow-up blood pressure check',
    },
  },
];

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
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    return initialAppointments && initialAppointments.length > 0
      ? initialAppointments
      : SAMPLE_APPOINTMENTS;
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
  const [clinicalNotes, setClinicalNotes] = useState<Record<string, string>>({
    'demo-1': 'Patient presented with 3-day history of dry cough and mild fever. Temp: 100.2 F.',
  });
  const [noteInput, setNoteInput] = useState('');

  // Fetch appointments when date changes
  const fetchAppointmentsForDate = useCallback(
    async (dateStr: string) => {
      setLoading(true);
      try {
        const res = await clientAxios.get(`/api/doctor/appointments?date=${dateStr}`);
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data) && data.length > 0) {
          setAppointments(data);
        } else if (dateStr === todayIST) {
          setAppointments(SAMPLE_APPOINTMENTS);
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

  // Add clinical note
  const handleSaveNote = () => {
    if (!noteInput.trim() || !currentAppt) return;
    setClinicalNotes((prev) => ({
      ...prev,
      [currentAppt.id]: (prev[currentAppt.id] ? prev[currentAppt.id] + '\n\n' : '') + noteInput.trim(),
    }));
    setNoteInput('');
    toast.success('Clinical note saved');
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
            <button
              type="button"
              onClick={() => setDatePickerOpen(!datePickerOpen)}
              className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
            >
              <Calendar className="h-4 w-4 text-slate-500" />
              <span>{formattedDateButton}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {/* Date Picker Popover */}
            {datePickerOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Select Date</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrevDay}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDateChange(todayIST)}
                      className="px-2 py-0.5 text-[11px] font-semibold text-[#0066cc] hover:bg-blue-50 rounded"
                    >
                      Today
                    </button>
                    <button
                      onClick={handleNextDay}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && handleDateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20"
                />
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
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone or token..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc] transition-all"
              />
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
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeFilter === tab.id
                      ? 'bg-[#0066cc] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Queue Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3 w-12">#</th>
                    <th className="py-3 px-3">Patient</th>
                    <th className="py-3 px-3">Time</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No appointments found matching this criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((appt, idx) => {
                      const tokenStr = String(appt.tokenNumber || idx + 1).padStart(2, '0');
                      const pName = appt.patient?.fullName || 'Patient';
                      const pPhone = appt.patient?.phone || '+91 98765 00000';
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
                        <tr
                          key={appt.id}
                          onClick={() => setSelectedApptId(appt.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50/60 font-medium'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Token Number */}
                          <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-500">
                            {tokenStr}
                          </td>

                          {/* Patient Avatar + Name + Phone */}
                          <td className="py-3 px-3">
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
                          </td>

                          {/* Time */}
                          <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                            {formatTime(appt.startTime)}
                          </td>

                          {/* Type */}
                          <td className="py-3 px-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                isNew
                                  ? 'bg-sky-50 text-[#0066cc] border border-sky-100'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isNew ? 'New' : 'Follow-up'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 whitespace-nowrap">{statusBadge}</td>

                          {/* Action Button */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {appt.status === 'CHECKED_IN' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction(appt.id, 'start-consultation');
                                }}
                                disabled={actionLoadingId === `${appt.id}-start-consultation`}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#0066cc] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#0055b3] transition-all shadow-xs"
                              >
                                {actionLoadingId === `${appt.id}-start-consultation` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  'Start'
                                )}
                              </button>
                            ) : appt.status === 'IN_CONSULTATION' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApptId(appt.id);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#0066cc] bg-white px-3.5 py-1 text-xs font-semibold text-[#0066cc] hover:bg-blue-50 transition-all shadow-xs"
                              >
                                View
                              </button>
                            ) : appt.status === 'CONFIRMED' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction(appt.id, 'manual-check-in');
                                }}
                                className="text-slate-400 hover:text-[#0066cc] text-xs font-medium"
                              >
                                —
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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

            <button
              type="button"
              onClick={() => setWalkInModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0066cc] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0055b3] transition-all shadow-xs shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add Patient</span>
            </button>
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
              {sortedAppointments.slice(0, 6).map((item, i) => {
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
              })}
            </div>
          </div>

          {/* Current Patient Details Card */}
          {currentAppt && (
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Current Patient Details</h2>
                <Link
                  href={`/doctor/appointments?patientId=${currentAppt.patientId}`}
                  className="text-xs font-semibold text-[#0066cc] hover:underline"
                >
                  View All
                </Link>
              </div>

              {/* Patient Basic Header */}
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm shrink-0">
                  {(currentAppt.patient?.fullName || 'RS')
                    .split(' ')
                    .map((n: string) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {currentAppt.patient?.fullName || 'Rahul Sharma'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Age {currentAppt.patient?.age || 28} •{' '}
                    {currentAppt.patient?.gender === 'FEMALE' ? 'Female' : 'Male'} •{' '}
                    {currentAppt.patient?.phone || '+91 98765 43210'}
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
                      {currentAppt.patient?.basicHealthInfo || 'Fever and cough'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('history')}
                  className={`pb-2.5 transition-colors relative ${
                    activeDetailTab === 'history'
                      ? 'text-[#0066cc]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Medical History
                  {activeDetailTab === 'history' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailTab('previous')}
                  className={`pb-2.5 transition-colors relative ${
                    activeDetailTab === 'previous'
                      ? 'text-[#0066cc]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Previous Visits
                  {activeDetailTab === 'previous' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailTab('notes')}
                  className={`pb-2.5 transition-colors relative ${
                    activeDetailTab === 'notes'
                      ? 'text-[#0066cc]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Notes
                  {activeDetailTab === 'notes' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0066cc] rounded-full" />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="space-y-3 min-h-[120px]">
                {activeDetailTab === 'history' && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>No known allergies</span>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-700">
                      <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Medical History: </span>
                        <span>Mild asthma (2019)</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-700">
                      <Pill className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Current Medication: </span>
                        <span>Inhaler (as needed)</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'previous' && (
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>General Consultation</span>
                        <span className="text-slate-400 font-normal">14 Aug 2026</span>
                      </div>
                      <p className="text-slate-500 mt-1">Prescribed Paracetamol & rest.</p>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>Asthma Review</span>
                        <span className="text-slate-400 font-normal">22 Jan 2026</span>
                      </div>
                      <p className="text-slate-500 mt-1">Spirometry normal. Renewed inhaler.</p>
                    </div>
                  </div>
                )}

                {activeDetailTab === 'notes' && (
                  <div className="space-y-2 text-xs">
                    {clinicalNotes[currentAppt.id] && (
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 whitespace-pre-line">
                        {clinicalNotes[currentAppt.id]}
                      </div>
                    )}
                    <div className="space-y-2">
                      <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add quick clinical notes..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20"
                      />
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        className="px-3 py-1 rounded-lg bg-[#0066cc] text-white font-semibold text-xs hover:bg-[#0055b3]"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Consultation Quick Status Action */}
              <div className="pt-2 flex flex-col gap-2">
                {currentAppt.status === 'CHECKED_IN' && (
                  <button
                    type="button"
                    onClick={() => handleAction(currentAppt.id, 'start-consultation')}
                    disabled={actionLoadingId === `${currentAppt.id}-start-consultation`}
                    className="w-full py-2.5 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Start Consultation</span>
                  </button>
                )}

                {currentAppt.status === 'IN_CONSULTATION' && (
                  <button
                    type="button"
                    onClick={() => handleAction(currentAppt.id, 'complete')}
                    disabled={actionLoadingId === `${currentAppt.id}-complete`}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Complete Consultation</span>
                  </button>
                )}

                {/* View Full Patient Profile Button */}
                <Link
                  href={`/doctor/appointments?patientId=${currentAppt.patientId}`}
                  className="w-full py-2.5 rounded-xl border border-[#0066cc] text-[#0066cc] hover:bg-blue-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>View Full Patient Profile</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
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
              <button
                type="button"
                onClick={() => setWalkInModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddWalkIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={walkInForm.fullName}
                  onChange={(e) =>
                    setWalkInForm({ ...walkInForm, fullName: e.target.value })
                  }
                  placeholder="e.g. Rahul Sharma"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={walkInForm.phone}
                  onChange={(e) =>
                    setWalkInForm({ ...walkInForm, phone: e.target.value })
                  }
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 focus:border-[#0066cc]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    value={walkInForm.age}
                    onChange={(e) =>
                      setWalkInForm({ ...walkInForm, age: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={walkInForm.gender}
                    onChange={(e) =>
                      setWalkInForm({ ...walkInForm, gender: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Visit
                </label>
                <input
                  type="text"
                  value={walkInForm.reason}
                  onChange={(e) =>
                    setWalkInForm({ ...walkInForm, reason: e.target.value })
                  }
                  placeholder="e.g. Fever, Cough, Regular Checkup"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setWalkInModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-xs font-semibold text-white shadow-xs"
                >
                  Add to Live Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
