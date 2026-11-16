import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile } from '@/lib/api/doctors';
import { getDoctorReceptionists } from '@/lib/api/receptionist';
import { DoctorReceptionistClient } from '@/components/doctor/DoctorReceptionistClient';

export const dynamic = 'force-dynamic';

export default async function DoctorReceptionistsPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  let profile = null;
  let receptionists: any[] = [];

  try {
    const profileRes = await getDoctorProfile(token);
    profile = profileRes.data || null;
  } catch (err) {
    console.error('Failed to load doctor profile:', err);
  }

  try {
    const recRes = await getDoctorReceptionists(token);
    receptionists = recRes.data || [];
  } catch (err) {
    console.error('Failed to load receptionists:', err);
  }

  return (
    <DoctorReceptionistClient
      user={user}
      doctor={profile}
      initialReceptionists={receptionists}
    />
  );
}
