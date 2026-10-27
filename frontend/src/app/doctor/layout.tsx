import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile } from '@/lib/api/doctors';
import { Navbar } from '@/components/common/Navbar';
import { DoctorSocketProvider } from '@/components/doctor/DoctorSocketProvider';

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'DOCTOR' || !token) {
    redirect('/login?next=/doctor/dashboard');
  }

  let profile = null;
  try {
    const res = await getDoctorProfile(token);
    profile = res.data;
  } catch {
    profile = null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-slate-900 selection:bg-blue-500/20 selection:text-blue-900">
      <Navbar user={user} />
      
      {/* Subtle top ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute top-60 -left-20 h-96 w-96 rounded-full bg-sky-500/5 blur-3xl" />
      </div>

      <main className="flex-1">
        {profile ? (
          <DoctorSocketProvider doctorId={profile.id}>
            {children}
          </DoctorSocketProvider>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
