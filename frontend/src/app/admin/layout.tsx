import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { AdminSidebarLayout } from '@/components/admin/AdminSidebarLayout';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();

  // If not logged in as ADMIN, redirect to admin login
  if (!user || user.role !== 'ADMIN') {
    return <div className="min-h-screen bg-[#fafafc]">{children}</div>;
  }

  return (
    <AdminSidebarLayout user={user}>
      {children}
    </AdminSidebarLayout>
  );
}

