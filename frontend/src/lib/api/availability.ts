import { apiFetch } from './client';
import { RecurringAvailability, ApiResponse } from '@/types';
import { RecurringAvailabilityInput } from '../schemas';

export interface DoctorAvailabilityDashboard {
  doctorId: string;
  allowFutureBooking: boolean;
  maxFutureBookingDays: number | null;
  recurring: RecurringAvailability[];
  customOverrides: Array<any>;
  generatedSchedule: Array<any>;
}

export async function getDoctorAvailability(token: string) {
  return apiFetch<{
    message?: string;
    data: DoctorAvailabilityDashboard | RecurringAvailability[];
  }>('/api/doctor/availability', {
    token,
  });
}

export async function createRecurringAvailability(
  data: RecurringAvailabilityInput,
  token: string,
) {
  return apiFetch<ApiResponse<RecurringAvailability | RecurringAvailability[]>>(
    '/api/doctor/availability',
    {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    },
  );
}

export async function updateRecurringAvailability(
  id: string,
  data: Partial<RecurringAvailabilityInput>,
  token: string,
) {
  return apiFetch<ApiResponse<RecurringAvailability>>(
    `/api/doctor/availability/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    },
  );
}

export async function deleteRecurringAvailability(id: string, token: string) {
  return apiFetch<ApiResponse<null>>(`/api/doctor/availability/${id}`, {
    method: 'DELETE',
    token,
  });
}
