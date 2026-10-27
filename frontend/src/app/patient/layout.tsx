import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getPatientProfile } from '@/lib/api/patient';
import { getUnreadCount } from '@/lib/api/notifications';
import { Navbar } from '@/components/common/Navbar';
import { PatientSocketProvider } from '@/components/patient/PatientSocketProvider';

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login?next=/patient/dashboard');
  }

  const [profileResult, notifResult] = await Promise.allSettled([
    getPatientProfile(token),
    getUnreadCount(token),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value?.data : null;
  const unreadCount = notifResult.status === 'fulfilled' ? notifResult.value?.unreadCount || 0 : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-slate-900 selection:bg-blue-500/20 selection:text-blue-900">
      <Navbar user={user} unreadCount={unreadCount} />
      
      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute top-60 -left-20 h-96 w-96 rounded-full bg-sky-500/5 blur-3xl" />
      </div>

      <main className="flex-1">
        {profile ? (
          <PatientSocketProvider patientId={profile.id}>
            {children}
          </PatientSocketProvider>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
