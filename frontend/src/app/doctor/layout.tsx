import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDoctorProfile } from '@/lib/api/doctors';
import { DoctorSocketProvider } from '@/components/doctor/DoctorSocketProvider';
import { DoctorSidebarLayout } from '@/components/doctor/DoctorSidebarLayout';

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
    <div className="min-h-screen bg-[#fafafc] text-zinc-900">
      {profile ? (
        <DoctorSocketProvider doctorId={profile.id} initialToken={token}>
          <DoctorSidebarLayout user={user} profile={profile}>
            {children}
          </DoctorSidebarLayout>
        </DoctorSocketProvider>
      ) : (
        <div className="min-h-screen bg-[#f6f8fb]">
          {children}
        </div>
      )}
    </div>
  );
}
