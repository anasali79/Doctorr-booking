import { apiFetch } from './client';
import {
  Patient,
  PatientDashboardResponse,
  Appointment,
  ApiResponse,
} from '@/types';
import { PatientProfileInput, BookingInput, RescheduleInput } from '../schemas';

export async function getPatientProfile(token: string) {
  const res = await apiFetch<any>('/api/patient/profile', {
    token,
  });
  const data = res?.data || res;
  return {
    message: res?.message,
    data: data as Patient,
  };
}

export async function savePatientProfile(
  data: PatientProfileInput,
  token: string,
  isUpdate = false,
) {
  return apiFetch<{
    message: string;
    data: Patient;
  }>('/api/patient/profile', {
    method: isUpdate ? 'PATCH' : 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function getPatientDashboard(token: string) {
  return apiFetch<PatientDashboardResponse>('/api/patient/dashboard', {
    token,
  });
}

export async function bookAppointment(data: BookingInput, token: string) {
  return apiFetch<ApiResponse<Appointment>>('/api/appointment', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function getPatientAppointments(token: string) {
  return apiFetch<{
    message?: string;
    data: Appointment[];
  }>('/api/appointment/my', {
    token,
  });
}

export async function cancelPatientAppointment(appointmentId: string, token: string) {
  return apiFetch<ApiResponse<Appointment>>(
    `/api/appointment/${appointmentId}/cancel`,
    {
      method: 'PATCH',
      token,
    },
  );
}

export async function reschedulePatientAppointment(
  appointmentId: string,
  data: RescheduleInput,
  token: string,
) {
  return apiFetch<{
    message: string;
    data: {
      previousAppointment: Partial<Appointment>;
      newAppointment: Appointment;
    };
  }>(`/api/appointment/${appointmentId}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}
