export type Role = 'DOCTOR' | 'PATIENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  exp?: number;
}

export interface Doctor {
  id: string;
  userId: string;
  fullName: string;
  specialization: string;
  experience: number;
  qualification: string;
  consultationFee: number;
  profileDetails?: string;
  currentServingToken?: number | null;
  allowFutureBooking: boolean;
  maxFutureBookingDays?: number | null;
  availabilityStatus?: string;
  user?: User;
}

export interface Patient {
  id: string;
  userId: string;
  fullName: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string;
  address?: string;
  basicHealthInfo?: string;
  allergies?: string;
  medicalHistory?: string;
  currentMedication?: string;
  bloodGroup?: string;
  contactDetails?: {
    phone: string;
    address?: string;
  };
  user?: User;
}

export type AppointmentStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED';

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: AppointmentStatus;
  paymentStatus?: string;
  pendingExpiresAt?: string | null;
  tokenNumber?: number | null;
  queuePosition?: number | null;
  estimatedWaitTime?: number | null;
  checkedInAt?: string | null;
  servedAt?: string | null;
  completedAt?: string | null;
  clinicalNotes?: string | null;
  reasonForVisit?: string | null;
  doctor?: Doctor;
  patient?: {
    id: string;
    fullName: string;
    age: number;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phone: string;
    address?: string;
    basicHealthInfo?: string;
    allergies?: string;
    medicalHistory?: string;
    currentMedication?: string;
    bloodGroup?: string;
  };
  schedulingType?: 'STREAM' | 'WAVE';
}

export interface Slot {
  startTime: string;
  endTime: string;
  status: string; // 'available', 'booked', 'cancel and available for booking', etc.
  schedulingType?: 'STREAM' | 'WAVE';
  bufferTime?: number;
  maxPatients?: number;
  bookedCount?: number;
  availableCount?: number;
}

export interface SlotsResponse {
  message?: string;
  data: Slot[];
  onLeave?: boolean;
}

export interface RecurringAvailability {
  id: string;
  doctorId: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotDuration: number;
  schedulingType: 'STREAM' | 'WAVE';
  bufferTime: number;
  maxPatients?: number;
}

export interface DoctorLeave {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  reason?: string;
}

export interface NotificationItem {
  id: string;
  patientId?: string;
  doctorId?: string;
  title: string;
  message: string;
  note?: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  remindersEnabled: boolean;
  paymentAlertsEnabled: boolean;
  refundAlertsEnabled: boolean;
}

export interface NotificationDeliveryItem {
  id: string;
  eventType: string;
  recipientId: string;
  recipientRole: string;
  channel: 'EMAIL' | 'IN_APP' | 'WHATSAPP' | 'SMS';
  destination: string;
  appointmentId?: string;
  paymentId?: string;
  status: 'PENDING' | 'PROCESSING' | 'ACCEPTED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRY_PENDING' | 'UNKNOWN';
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
  appointment?: {
    id: string;
    date: string;
    startTime: string;
  };
}

export interface NotificationDeliveryStats {
  total: number;
  successful: number;
  failed: number;
  retryPending: number;
  channelBreakdown: { channel: string; status: string; count: string | number }[];
}

export interface DoctorDashboardStats {
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  totalPatients: number;
}

export interface DoctorDashboardData {
  doctorId: string;
  stats: DoctorDashboardStats;
  todayAppointments: Appointment[];
}

export interface DoctorDashboardResponse {
  message?: string;
  data?: DoctorDashboardData;
  doctorId?: string;
  stats?: DoctorDashboardStats;
  todayAppointments?: Appointment[];
}

export interface PatientDashboardResponse {
  message?: string;
  data?: {
    upcoming: Appointment[];
    past: Appointment[];
    liveQueue?: {
      appointmentId: string;
      tokenNumber: number;
      queuePosition: number;
      estimatedWaitTime: number;
      doctorName: string;
      status: AppointmentStatus;
    } | null;
  };
}

export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
