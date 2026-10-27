import { apiFetch } from './client';
import {
  Doctor,
  SlotsResponse,
  DoctorDashboardResponse,
  DoctorDashboardData,
  DoctorDashboardStats,
  Appointment,
  ApiResponse,
} from '@/types';
import { DoctorProfileInput } from '../schemas';

export async function getDoctors(params: {
  search?: string;
  specialization?: string;
  availability?: string;
  page?: number;
  limit?: number;
}) {
  return apiFetch<{
    message?: string;
    data: Doctor[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>('/api/doctor', { params });
}

export async function getDoctorById(id: string) {
  return apiFetch<{
    message?: string;
    data: Doctor;
  }>(`/api/doctor/${id}`);
}

export async function getDoctorSlots(doctorId: string, date: string, duration?: number) {
  return apiFetch<SlotsResponse>(`/api/doctor/${doctorId}/slots`, {
    params: { date, duration },
  });
}

export async function getDoctorProfile(token: string) {
  const res = await apiFetch<any>('/api/doctor/profile', {
    token,
  });
  const data = res?.data || res;
  return {
    message: res?.message,
    data: data as Doctor,
  };
}

export async function saveDoctorProfile(
  data: DoctorProfileInput,
  token: string,
  isUpdate = false,
) {
  return apiFetch<{
    message: string;
    data: Doctor;
  }>('/api/doctor/profile', {
    method: isUpdate ? 'PATCH' : 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function getDoctorDashboard(token: string): Promise<DoctorDashboardResponse> {
  const res = await apiFetch<any>('/api/doctor/dashboard', {
    token,
  });
  const data = res?.data || res;
  return {
    message: res?.message,
    data: data as DoctorDashboardData,
    stats: (data?.stats || {
      today: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      totalPatients: 0,
    }) as DoctorDashboardStats,
    todayAppointments: (data?.todayAppointments || []) as Appointment[],
    doctorId: data?.doctorId || '',
  };
}

export async function getDoctorAppointments(date: string, token: string) {
  return apiFetch<{
    message?: string;
    data: Appointment[];
  }>('/api/doctor/appointments', {
    params: { date },
    token,
  });
}

export async function updateAppointmentStatus(
  appointmentId: string,
  action: 'manual-check-in' | 'start-consultation' | 'complete' | 'no-show',
  token: string,
) {
  return apiFetch<ApiResponse<Appointment>>(
    `/api/appointments/${appointmentId}/${action}`,
    {
      method: 'POST',
      token,
    },
  );
}

export async function cancelDoctorAppointment(appointmentId: string, token: string) {
  return apiFetch<ApiResponse<Appointment>>(
    `/api/doctor/appointments/${appointmentId}/cancel`,
    {
      method: 'PATCH',
      token,
    },
  );
}
