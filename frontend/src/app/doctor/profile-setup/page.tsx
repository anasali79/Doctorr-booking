import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile } from '@/lib/api/doctors';
import { DoctorProfileForm } from '@/components/doctor/DoctorProfileForm';
import { Stethoscope } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DoctorProfileSetupPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login');
  }

  // If doctor already has profile, redirect to dashboard
  let hasProfile = false;
  try {
    const res = await getDoctorProfile(token);
    if (res?.data?.id) {
      hasProfile = true;
    }
  } catch {
    hasProfile = false;
  }

  if (hasProfile) {
    redirect('/doctor/dashboard');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <Stethoscope className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
            Welcome, Doctor! Complete Your Practitioner Profile
          </h2>
          <p className="text-xs text-sky-700 dark:text-sky-300 mt-0.5">
            Patients discover your practice by specialty, credentials, and consultation fees. Please set up your professional credentials below.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Practitioner Profile Setup
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Provide your qualifications and clinical consultation terms.
          </p>
        </div>

        <DoctorProfileForm isSetup={true} />
      </div>
    </div>
  );
}
