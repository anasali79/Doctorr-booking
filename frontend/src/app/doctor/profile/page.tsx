import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile } from '@/lib/api/doctors';
import { DoctorProfileForm } from '@/components/doctor/DoctorProfileForm';
import { Stethoscope, Sparkles } from 'lucide-react';

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="flex items-center gap-3.5 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#0066cc] text-white flex items-center justify-center shadow-xs">
          <Stethoscope className="w-6 h-6" />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-[#0066cc]">
            <Sparkles className="h-3.5 w-3.5 text-[#0066cc]" />
            <span>CLINICAL CREDENTIALS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Doctor Profile & Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Update your professional qualifications, consultation fees, and future booking limits
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/90 bg-white shadow-sm p-6 sm:p-8">
        <DoctorProfileForm initialData={profile} isSetup={false} />
      </div>
    </div>
  );
}
