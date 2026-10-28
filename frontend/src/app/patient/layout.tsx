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
    <div className="flex min-h-screen flex-col bg-[#fafafc] text-zinc-900 relative overflow-hidden">
      <Navbar user={user} unreadCount={unreadCount} />

      <main className="flex-1">
        {profile ? (
          <PatientSocketProvider patientId={profile.id} initialToken={token}>
            {children}
          </PatientSocketProvider>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
