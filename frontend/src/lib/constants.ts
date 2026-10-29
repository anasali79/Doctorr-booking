import { AppointmentStatus } from '@/types';

export const SPECIALIZATIONS = [
  'cardiologist',
  'dermatologist',
  'neurologist',
  'pediatrician',
  'orthopedist',
  'general physician',
  'gynecologist',
  'psychiatrist',
  'ophthalmologist',
  'ent specialist',
] as const;

export const SPECIALIZATION_LABELS: Record<string, string> = {
  cardiologist: 'Cardiologist',
  dermatologist: 'Dermatologist',
  neurologist: 'Neurologist',
  pediatrician: 'Pediatrician',
  orthopedist: 'Orthopedist',
  'general physician': 'General Physician',
  gynecologist: 'Gynecologist',
  psychiatrist: 'Psychiatrist',
  ophthalmologist: 'Ophthalmologist',
  'ent specialist': 'ENT Specialist',
};

export const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  PENDING_PAYMENT: {
    label: 'Pending Payment',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  CHECKED_IN: {
    label: 'Checked In',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  IN_CONSULTATION: {
    label: 'In Consultation',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
  NO_SHOW: {
    label: 'No Show',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
  RESCHEDULED: {
    label: 'Rescheduled',
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-500',
  },
};

export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const SESSION_COOKIE_NAME = 'access_token';
