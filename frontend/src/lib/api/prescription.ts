import { clientAxios } from './axios';
import { CreatePrescriptionPayload, Prescription } from '@/types/prescription';

export async function savePrescription(
  payload: CreatePrescriptionPayload,
): Promise<{ message: string; data: Prescription }> {
  const res = await clientAxios.post<{ message: string; data: Prescription }>(
    '/api/prescriptions',
    payload,
  );
  return res.data;
}

export async function getPrescriptionByAppointment(
  appointmentId: string,
): Promise<Prescription | null> {
  try {
    const res = await clientAxios.get<{ message: string; data: Prescription }>(
      `/api/prescriptions/appointment/${appointmentId}`,
    );
    return res.data?.data || null;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function getMyPrescriptions(): Promise<Prescription[]> {
  const res = await clientAxios.get<{ message: string; data: Prescription[] }>(
    '/api/prescriptions/my',
  );
  return res.data?.data || [];
}

export async function getPrescriptionById(
  id: string,
): Promise<Prescription | null> {
  const res = await clientAxios.get<{ message: string; data: Prescription }>(
    `/api/prescriptions/${id}`,
  );
  return res.data?.data || null;
}

