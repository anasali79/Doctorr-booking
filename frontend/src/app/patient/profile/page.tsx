import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile } from '@/lib/api/patient';
import { PatientProfileForm } from '@/components/patient/PatientProfileForm';
import { UserCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PatientProfilePage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  let profile = null;

  try {
    const profileRes = await getPatientProfile(token);
    profile = profileRes?.data || null;
  } catch {
    profile = null;
  }

  if (!profile) {
    redirect('/patient/profile-setup');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="flex items-center gap-3.5 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#0066cc] text-white flex items-center justify-center shadow-xs">
          <UserCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Patient Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage your personal clinical contact details and health history
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="rounded-3xl border border-slate-200/90 bg-white shadow-sm p-6 sm:p-8">
          <PatientProfileForm initialData={profile} isSetup={false} />
        </div>
      </div>
    </div>
  );
}
