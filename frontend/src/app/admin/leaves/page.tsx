import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getAdminLeaves } from '@/lib/api/admin';
import { AdminLeavesClient } from '@/components/admin/AdminLeavesClient';

export const dynamic = 'force-dynamic';

export default async function AdminLeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const { user, token } = await getSession();

  if (!user || user.role !== 'ADMIN' || !token) {
    redirect('/admin/login');
  }

  const resolvedParams = await searchParams;
  const status = resolvedParams.status || 'ALL';
  const search = resolvedParams.search || '';
  const page = Math.max(1, parseInt(resolvedParams.page || '1') || 1);

  const res = await getAdminLeaves(
    { status: status === 'ALL' ? undefined : status, search, page, limit: 50 },
    token,
  ).catch(() => null);

  const leaves = res?.data || [];
  const meta = res?.meta || {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  };

  return (
    <AdminLeavesClient
      initialLeaves={leaves}
      initialMeta={meta}
      initialStatus={status}
      token={token}
    />
  );
}
