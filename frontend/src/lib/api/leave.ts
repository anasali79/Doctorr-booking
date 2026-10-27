import { apiFetch } from './client';
import { DoctorLeave, ApiResponse } from '@/types';
import { DoctorLeaveInput } from '../schemas';

export async function getDoctorLeaves(token: string) {
  return apiFetch<{
    message?: string;
    data: DoctorLeave[];
  }>('/api/doctor/leave', {
    token,
  });
}

export async function addDoctorLeave(data: DoctorLeaveInput, token: string) {
  return apiFetch<ApiResponse<DoctorLeave>>('/api/doctor/leave', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteDoctorLeave(id: string, token: string) {
  return apiFetch<ApiResponse<null>>(`/api/doctor/leave/${id}`, {
    method: 'DELETE',
    token,
  });
}
