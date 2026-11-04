import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getAdminDoctorDetails } from '@/lib/api/admin';
import { AdminDoctorReviewClient } from '@/components/admin/AdminDoctorReviewClient';

export const dynamic = 'force-dynamic';

export default async function AdminDoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'ADMIN' || !token) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const res = await getAdminDoctorDetails(id, token).catch(() => null);

  if (!res?.data) {
    redirect('/admin/doctors');
  }

  return <AdminDoctorReviewClient doctor={res.data} token={token} />;
}

