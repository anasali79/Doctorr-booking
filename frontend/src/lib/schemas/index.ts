import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['DOCTOR', 'PATIENT']),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const patientProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  age: z.coerce.number().int().min(0, 'Age must be 0 or greater').max(120, 'Invalid age'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phone: z.string().trim().regex(/^[0-9]{10}$/, 'Phone number must be a valid 10-digit number'),
  address: z.string().trim().optional(),
  basicHealthInfo: z.string().trim().optional(),
});

export interface PatientProfileInput {
  fullName: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  address?: string;
  basicHealthInfo?: string;
}

export const doctorProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  specialization: z.string().min(1, 'Please select a specialization'),
  experience: z.coerce.number().int().min(0, 'Experience must be positive'),
  qualification: z.string().trim().min(2, 'Qualification is required (e.g., MBBS, MD)'),
  consultationFee: z.coerce.number().min(0, 'Consultation fee cannot be negative'),
  profileDetails: z.string().trim().optional(),
  allowFutureBooking: z.boolean().default(true),
  maxFutureBookingDays: z.coerce.number().int().min(1).max(90).nullable().optional(),
});

export interface DoctorProfileInput {
  fullName: string;
  specialization: string;
  experience: number;
  qualification: string;
  consultationFee: number;
  profileDetails?: string;
  allowFutureBooking?: boolean;
  maxFutureBookingDays?: number | null;
}

export const bookingSchema = z.object({
  doctorId: z.string().uuid('Invalid Doctor ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format'),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const rescheduleSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format').optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format').optional(),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    newStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format').optional(),
    newEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format').optional(),
  })
  .transform((data) => ({
    date: (data.date || data.newDate) as string,
    startTime: (data.startTime || data.newStartTime) as string,
    endTime: (data.endTime || data.newEndTime) as string,
  }))
  .refine((data) => Boolean(data.date && data.startTime && data.endTime), {
    message: 'Date, startTime, and endTime are required for rescheduling',
  });

export type RescheduleInput = z.infer<typeof rescheduleSchema>;

export const recurringAvailabilitySchema = z.object({
  daysOfWeek: z.array(z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])).min(1, 'Select at least one day'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid start time (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid end time (HH:mm)'),
  slotDuration: z.coerce.number().int().refine((val) => [15, 20, 30, 45, 60].includes(val), {
    message: 'Slot duration must be 15, 20, 30, 45, or 60 minutes',
  }),
  schedulingType: z.enum(['STREAM', 'WAVE']).default('STREAM'),
  bufferTime: z.coerce.number().int().min(0).default(0),
  maxPatients: z.coerce.number().int().min(1).optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export type RecurringAvailabilityInput = z.infer<typeof recurringAvailabilitySchema>;

export const doctorLeaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().trim().optional(),
});

export type DoctorLeaveInput = z.infer<typeof doctorLeaveSchema>;
