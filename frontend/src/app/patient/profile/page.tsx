import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile } from '@/lib/api/patient';
import { PatientProfileForm } from '@/components/patient/PatientProfileForm';
import { UserCheck, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PatientProfilePage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login');
  }

  let profile = null;
  try {
    const res = await getPatientProfile(token);
    profile = res.data;
  } catch {
    profile = null;
  }

  if (!profile) {
    redirect('/patient/profile-setup');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="flex items-center gap-3.5 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shadow-xs">
          <UserCheck className="w-6 h-6" />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-black/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-zinc-800">
            <Sparkles className="h-3 w-3 text-black" />
            <span>ACCOUNT SETTINGS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 mt-1">
            Patient Profile
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Manage your personal clinical contact details and health history
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-black/[0.08] bg-white/95 backdrop-blur-2xl shadow-sm p-6 sm:p-8">
        <PatientProfileForm initialData={profile} isSetup={false} />
      </div>
    </div>
  );
}
