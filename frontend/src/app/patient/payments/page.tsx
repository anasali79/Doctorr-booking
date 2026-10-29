import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { PageHeader } from '@/components/common/PageHeader';
import { PatientPaymentsClient } from '@/components/patient/PatientPaymentsClient';

export const dynamic = 'force-dynamic';

export default async function PatientPaymentsPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'PATIENT' || !token) {
    redirect('/login?next=/patient/payments');
  }

  return (
    <div className="page-container py-8 sm:py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <PageHeader
          eyebrow="Billing & Receipts"
          title="Payment & Refund History"
          description="View all consultation transactions, invoices, and automated refund statuses."
        />

        <PatientPaymentsClient />
      </div>
    </div>
  );
}
