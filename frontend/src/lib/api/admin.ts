import { apiFetch } from './client';
import { clientAxios, serverAxios, getNormalizedBaseUrl } from './axios';
import { DoctorVerification, AdminDashboardStats, ApiResponse } from '@/types';

// ─── Doctor-Side Verification APIs ──────────────────────────────────────────

export async function getDoctorVerificationStatus(token?: string): Promise<ApiResponse<DoctorVerification>> {
  return apiFetch<ApiResponse<DoctorVerification>>('/api/doctor/verification/status', {
    token,
  });
}

export async function submitDoctorVerification(
  formData: FormData,
  token?: string,
): Promise<ApiResponse<{ status: string; submittedAt: string }>> {
  const isServer = typeof window === 'undefined';
  const endpoint = isServer
    ? `${getNormalizedBaseUrl()}/api/doctor/verification/submit`
    : '/api/doctor/verification/submit';

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      data?.message || data?.error || 'Failed to submit verification';
    throw new Error(
      typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg),
    );
  }

  return data;
}

// ─── Admin APIs ─────────────────────────────────────────────────────────────

export async function adminLogin(credentials: { email: string; password: string }) {
  return apiFetch<any>('/api/admin/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export async function adminLogout() {
  return apiFetch<any>('/api/admin/auth/logout', {
    method: 'POST',
  });
}

export async function getAdminDashboardStats(token?: string): Promise<ApiResponse<AdminDashboardStats>> {
  return apiFetch<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard', {
    token,
  });
}

export interface ListDoctorsParams {
  [key: string]: string | number | boolean | null | undefined;
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export async function listAdminDoctors(
  params: ListDoctorsParams,
  token?: string,
): Promise<ApiResponse<any[]>> {
  return apiFetch<ApiResponse<any[]>>('/api/admin/doctors', {
    params,
    token,
  });
}

export async function getAdminDoctorDetails(doctorId: string, token?: string) {
  return apiFetch<any>(`/api/admin/doctors/${doctorId}`, {
    token,
  });
}

export async function approveDoctor(doctorId: string, token?: string) {
  return apiFetch<any>(`/api/admin/doctors/${doctorId}/approve`, {
    method: 'PATCH',
    token,
  });
}

export async function rejectDoctor(doctorId: string, reason: string, token?: string) {
  return apiFetch<any>(`/api/admin/doctors/${doctorId}/reject`, {
    method: 'PATCH',
    body: { reason },
    token,
  });
}

export async function requestResubmission(doctorId: string, reason: string, token?: string) {
  return apiFetch<any>(`/api/admin/doctors/${doctorId}/request-resubmission`, {
    method: 'PATCH',
    body: { reason },
    token,
  });
}

export async function suspendDoctor(doctorId: string, reason: string, token?: string) {
  return apiFetch<any>(`/api/admin/doctors/${doctorId}/suspend`, {
    method: 'PATCH',
    body: { reason },
    token,
  });
}
