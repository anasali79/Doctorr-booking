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
    bg: 'bg-amber-100/90 dark:bg-amber-950/80',
    text: 'text-amber-950 dark:text-amber-100 font-bold',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-blue-100/90 dark:bg-blue-950/80',
    text: 'text-blue-950 dark:text-blue-100 font-bold',
    border: 'border-blue-300 dark:border-blue-700',
    dot: 'bg-blue-600 dark:bg-blue-400',
  },
  CHECKED_IN: {
    label: 'Checked In',
    bg: 'bg-amber-100/90 dark:bg-amber-950/80',
    text: 'text-amber-950 dark:text-amber-100 font-bold',
    border: 'border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  IN_CONSULTATION: {
    label: 'In Consultation',
    bg: 'bg-purple-100/90 dark:bg-purple-950/80',
    text: 'text-purple-950 dark:text-purple-100 font-bold',
    border: 'border-purple-300 dark:border-purple-700',
    dot: 'bg-purple-600 dark:bg-purple-400',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-emerald-100/90 dark:bg-emerald-950/80',
    text: 'text-emerald-950 dark:text-emerald-100 font-bold',
    border: 'border-emerald-300 dark:border-emerald-700',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-100/90 dark:bg-rose-950/80',
    text: 'text-rose-950 dark:text-rose-100 font-bold',
    border: 'border-rose-300 dark:border-rose-700',
    dot: 'bg-rose-600 dark:bg-rose-400',
  },
  NO_SHOW: {
    label: 'No Show',
    bg: 'bg-zinc-200/90 dark:bg-zinc-800',
    text: 'text-zinc-950 dark:text-zinc-100 font-bold',
    border: 'border-zinc-300 dark:border-zinc-600',
    dot: 'bg-zinc-600 dark:bg-zinc-400',
  },
  RESCHEDULED: {
    label: 'Rescheduled',
    bg: 'bg-indigo-100/90 dark:bg-indigo-950/80',
    text: 'text-indigo-950 dark:text-indigo-100 font-bold',
    border: 'border-indigo-300 dark:border-indigo-700',
    dot: 'bg-indigo-600 dark:bg-indigo-400',
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
