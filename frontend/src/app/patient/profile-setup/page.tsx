import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile } from '@/lib/api/patient';
import { PatientProfileForm } from '@/components/patient/PatientProfileForm';
import { BrandMark } from '@/components/ui/BrandMark';
import { Heart, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900 py-10 sm:py-16 px-4 relative overflow-hidden flex flex-col justify-center items-center">
      {/* Background Subtle Gradient Glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-ambient-light-mesh opacity-90" />

      <div className="w-full max-w-2xl space-y-6">
        {/* Brand Header & Stepper */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <BrandMark size="md" />
            <div className="text-left">
              <span className="block text-lg font-extrabold leading-none text-slate-900">
                Care<span className="text-[#0066cc]">Up</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                Patient Registration
              </span>
            </div>
          </Link>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-center gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              1. Account Created
            </span>
            <span className="text-slate-300">→</span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full font-bold bg-[#e8f2fe] text-[#0066cc] border border-blue-200 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#0066cc]" />
              2. Patient Profile (Setup)
            </span>
          </div>
        </div>

        {/* Clinical Info Banner */}
        <div className="rounded-2xl border border-blue-100 bg-[#eef6ff] p-4.5 flex items-start gap-3.5 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-[#0066cc] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Complete Your Patient Health Profile
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Before booking appointments, please provide your contact and clinical details so your doctor has the relevant medical history during consultations.
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-9 shadow-sm">
          <div className="mb-6 pb-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                Patient Details
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Add your age, contact number, and any known allergies or medical history.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0066cc]" />
              <span>Confidential & Secure</span>
            </div>
          </div>

          <PatientProfileForm isSetup={true} />
        </div>
      </div>
    </div>
  );
}
