import { apiFetch } from './client';
import { Receptionist, Appointment } from '@/types';

export interface CreateReceptionistPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  deskNumber?: string;
}

export interface CreateWalkInPayload {
  fullName: string;
  phone: string;
  age?: number;
  gender?: string;
  reason?: string;
  doctorId?: string;
}

// ─── Doctor endpoints to manage receptionists ────────────────────────────────

export async function createReceptionist(data: CreateReceptionistPayload, token?: string) {
  return apiFetch<{ message: string; data: Receptionist }>('/api/doctor/receptionists', {
    method: 'POST',
    body: data,
    token,
  });
}

export async function getDoctorReceptionists(token?: string) {
  return apiFetch<{ data: Receptionist[] }>('/api/doctor/receptionists', {
    token,
  });
}

export async function toggleReceptionistStatus(id: string, token?: string) {
  return apiFetch<{ message: string; data: { id: string; isActive: boolean } }>(
    `/api/doctor/receptionists/${id}/toggle`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export async function deleteReceptionist(id: string, token?: string) {
  return apiFetch<{ message: string }>(`/api/doctor/receptionists/${id}`, {
    method: 'DELETE',
    token,
  });
}

// ─── Receptionist Portal endpoints ──────────────────────────────────────────

export async function getReceptionistMe(token?: string) {
  return apiFetch<{ data: Receptionist }>('/api/receptionist/me', {
    token,
  });
}

export async function getReceptionistAppointments(
  doctorIdOrToken?: string,
  token?: string,
) {
  let docId: string | undefined = doctorIdOrToken;
  let authToken: string | undefined = token;

  // Handle case where token is passed as first argument
  if (!token && doctorIdOrToken && doctorIdOrToken.includes('.')) {
    authToken = doctorIdOrToken;
    docId = undefined;
  }

  const query = docId ? `?doctorId=${encodeURIComponent(docId)}` : '';
  return apiFetch<{
    doctor: {
      id: string;
      fullName: string;
      specialization: string;
      consultationFee: number;
      phone?: string | null;
      currentServingToken?: number | null;
    };
    allDoctors?: Array<{
      id: string;
      fullName: string;
      specialization: string;
      consultationFee: number;
      phone?: string | null;
    }>;
    data: Appointment[];
  }>(`/api/receptionist/appointments${query}`, {
    token: authToken,
  });
}

export async function getReceptionistQueue(
  date?: string,
  doctorId?: string,
  token?: string,
) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (doctorId) params.set('doctorId', doctorId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<{
    doctor: {
      id: string;
      fullName: string;
      specialization: string;
      consultationFee: number;
      phone?: string | null;
      currentServingToken?: number | null;
    };
    allDoctors?: Array<{
      id: string;
      fullName: string;
      specialization: string;
      consultationFee: number;
      phone?: string | null;
    }>;
    yesterdayStats?: {
      total: number;
      completed: number;
    };
    data: Appointment[];
  }>(`/api/receptionist/queue${query}`, {
    token,
  });
}

export async function handleReceptionistAction(
  appointmentId: string,
  action: 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show',
  token?: string,
) {
  return apiFetch<{ message: string; data: any }>(
    `/api/receptionist/appointments/${appointmentId}/action?action=${action}`,
    {
      method: 'POST',
      token,
    },
  );
}

export async function cancelReceptionistAppointment(
  appointmentId: string,
  token?: string,
) {
  return apiFetch<{ message: string }>(
    `/api/receptionist/appointments/${appointmentId}/cancel`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export async function rescheduleReceptionistAppointment(
  appointmentId: string,
  data: {
    date: string;
    startTime: string;
    endTime: string;
    rescheduleReason?: string;
  },
  token?: string,
) {
  return apiFetch<{ message: string; data: any }>(
    `/api/receptionist/appointments/${appointmentId}/reschedule`,
    {
      method: 'PATCH',
      body: data,
      token,
    },
  );
}

export async function createReceptionistWalkIn(
  data: CreateWalkInPayload,
  token?: string,
) {
  return apiFetch<{ message: string; data: any }>(
    '/api/receptionist/appointments/walk-in',
    {
      method: 'POST',
      body: data,
      token,
    },
  );
}
