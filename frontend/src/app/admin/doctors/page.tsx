import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { listAdminDoctors } from '@/lib/api/admin';
import { AdminDoctorsClient } from '@/components/admin/AdminDoctorsClient';

export const dynamic = 'force-dynamic';

export default async function AdminDoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'ADMIN' || !token) {
    redirect('/admin/login');
  }

  const resolvedParams = await searchParams;
  const status = resolvedParams.status || '';
  const search = resolvedParams.search || '';
  const page = Math.max(1, parseInt(resolvedParams.page || '1') || 1);

  const res = await listAdminDoctors(
    { status, search, page, limit: 50 },
    token,
  ).catch(() => null);

  const doctors = res?.data || [];
  const meta = res?.meta || { page: 1, limit: 50, total: 0, totalPages: 0 };

  return (
    <AdminDoctorsClient
      initialDoctors={doctors}
      initialMeta={meta}
      initialStatus={status}
      initialSearch={search}
    />
  );
}

