import React from 'react';
import { getSession } from '@/lib/auth/session';
import { getDoctors } from '@/lib/api/doctors';
import { HomePageClient } from '@/components/home/HomePageClient';

export default async function HomePage() {
  const { user } = await getSession();

  let doctors: any[] = [];
  try {
    const res = await getDoctors({ limit: 12 });
    doctors = res.data || [];
  } catch {
    doctors = [];
  }

  return <HomePageClient user={user} doctors={doctors} />;
}
