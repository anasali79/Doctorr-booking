import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getReceptionistMe } from '@/lib/api/receptionist';
import { ReceptionistLayout } from '@/components/receptionist/ReceptionistLayout';

export const dynamic = 'force-dynamic';

export default async function ReceptionistRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'RECEPTIONIST' || !token) {
    redirect('/login');
  }

  let receptionist = null;
  try {
    const res = await getReceptionistMe(token);
    receptionist = res.data || null;
  } catch (err) {
    console.error('Failed to load receptionist profile:', err);
  }

  return (
    <ReceptionistLayout user={user} receptionist={receptionist}>
      {children}
    </ReceptionistLayout>
  );
}
