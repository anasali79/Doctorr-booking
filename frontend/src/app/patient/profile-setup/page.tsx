import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile } from '@/lib/api/patient';
import { PatientProfileForm } from '@/components/patient/PatientProfileForm';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PatientProfileSetupPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  // If patient already has a profile, redirect to dashboard
  let hasProfile = false;
  try {
    const res = await getPatientProfile(token);
    if (res?.data?.id) {
      hasProfile = true;
    }
  } catch {
    hasProfile = false;
  }

  if (hasProfile) {
    redirect('/patient/dashboard');
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Profile Setup Required
          </h2>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Before booking your first appointment, please provide your basic clinical details so doctors have the required medical history.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Set Up Your Patient Profile
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fill in your details below to activate your account.
          </p>
        </div>

        <PatientProfileForm isSetup={true} />
      </div>
    </div>
  );
}
