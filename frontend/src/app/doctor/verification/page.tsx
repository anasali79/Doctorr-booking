import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile } from '@/lib/api/doctors';
import { getDoctorVerificationStatus } from '@/lib/api/admin';
import { DoctorVerificationClient } from '@/components/doctor/DoctorVerificationClient';

export const dynamic = 'force-dynamic';

export default async function DoctorVerificationPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login?next=/doctor/verification');
  }

  // Ensure doctor profile exists first
  let profile = null;
  try {
    const res = await getDoctorProfile(token);
    profile = res.data;
  } catch {
    profile = null;
  }

  if (!profile) {
    redirect('/doctor/profile-setup');
  }

  let verification = null;
  try {
    const res = await getDoctorVerificationStatus(token);
    verification = res.data || null;
  } catch {
    verification = null;
  }

  return (
    <div className="py-6 sm:py-10 px-4 sm:px-6 max-w-5xl mx-auto">
      <DoctorVerificationClient
        initialVerification={verification}
        doctorProfile={profile}
        token={token}
      />
    </div>
  );
}

