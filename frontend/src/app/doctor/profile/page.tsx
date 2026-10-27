import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile } from '@/lib/api/doctors';
import { DoctorProfileForm } from '@/components/doctor/DoctorProfileForm';
import { Stethoscope } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DoctorProfilePage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  let profile = null;
  try {
    const res = await getDoctorProfile(token);
    profile = res?.data || null;
  } catch {
    profile = null;
  }

  if (!profile) {
    redirect('/doctor/profile-setup');
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center">
          <Stethoscope className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Doctor Profile & Clinical Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Update your professional qualifications, fees, and booking window settings
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 sm:p-8">
        <DoctorProfileForm initialData={profile} isSetup={false} />
      </div>
    </div>
  );
}
