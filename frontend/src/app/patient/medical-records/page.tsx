import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import {
  getPatientProfile,
  getPatientAppointments,
  getPatientMedicalHistoryLogs,
} from '@/lib/api/patient';
import { PatientMedicalRecordsClient } from '@/components/patient/PatientMedicalRecordsClient';

export const dynamic = 'force-dynamic';

export default async function PatientMedicalRecordsPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login?next=/patient/medical-records');
  }

  const [profileRes, apptsRes, logsRes] = await Promise.allSettled([
    getPatientProfile(token),
    getPatientAppointments(token),
    getPatientMedicalHistoryLogs(token),
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value?.data : null;

  if (!profile) {
    redirect('/patient/profile-setup');
  }

  const rawAppointments = apptsRes.status === 'fulfilled' ? apptsRes.value?.data || [] : [];
  const historyLogs = logsRes.status === 'fulfilled' ? logsRes.value?.data || [] : [];

  return (
    <PatientMedicalRecordsClient
      patient={profile}
      appointments={rawAppointments}
      historyLogs={historyLogs}
    />
  );
}
