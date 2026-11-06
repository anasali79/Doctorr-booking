import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getAdminDashboardStats } from '@/lib/api/admin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  UserCheck,
  Clock,
  XCircle,
  AlertTriangle,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const { user, token } = await getSession();

  if (!user || user.role !== 'ADMIN' || !token) {
    redirect('/admin/login');
  }

  const res = await getAdminDashboardStats(token).catch(() => null);
  const stats = res?.data || {
    totalDoctors: 0,
    pendingVerifications: 0,
    approvedDoctors: 0,
    rejectedDoctors: 0,
    suspendedDoctors: 0,
    totalPatients: 0,
    totalAppointments: 0,
  };

  const statCards = [
    {
      label: 'Pending Verifications',
      value: stats.pendingVerifications,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      badge: stats.pendingVerifications > 0 ? 'Requires Action' : 'All Clear',
      badgeColor:
        stats.pendingVerifications > 0
          ? 'bg-amber-100 text-amber-900 border-amber-300'
          : 'bg-emerald-100 text-emerald-800 border-emerald-200',
      href: '/admin/doctors?status=PENDING',
    },
    {
      label: 'Approved Doctors',
      value: stats.approvedDoctors,
      icon: UserCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      badge: 'Active Clinicians',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      href: '/admin/doctors?status=APPROVED',
    },
    {
      label: 'Total Registered Doctors',
      value: stats.totalDoctors,
      icon: Users,
      color: 'text-[#0066cc]',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      badge: 'All Statuses',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      href: '/admin/doctors',
    },
    {
      label: 'Rejected Applications',
      value: stats.rejectedDoctors,
      icon: XCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      badge: 'Declined',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      href: '/admin/doctors?status=REJECTED',
    },
    {
      label: 'Suspended Accounts',
      value: stats.suspendedDoctors,
      icon: AlertTriangle,
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      border: 'border-slate-300',
      badge: 'Blocked',
      badgeColor: 'bg-slate-200 text-slate-800 border-slate-300',
      href: '/admin/doctors?status=SUSPENDED',
    },
    {
      label: 'Registered Patients',
      value: stats.totalPatients,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      badge: 'Platform Users',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    {
      label: 'Total Appointments',
      value: stats.totalAppointments,
      icon: CalendarCheck,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      badge: 'Lifetime Consultations',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Overview Welcome Banner */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0066cc] border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CareUp Medical Operations Overview</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Administrator Console
          </h1>
          <p className="text-sm text-slate-500">
            Real-time compliance monitoring, doctor verification queue, and platform analytics.
          </p>
        </div>

        {stats.pendingVerifications > 0 && (
          <Link href="/admin/doctors?status=PENDING">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Review {stats.pendingVerifications} Pending Application{stats.pendingVerifications > 1 ? 's' : ''}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        )}
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.slice(0, 4).map((c, i) => {
          const Icon = c.icon;
          return (
            <Card
              key={i}
              className={`rounded-3xl border ${c.border} bg-white p-6 shadow-xs space-y-4 hover:shadow-md transition-all`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-2xl ${c.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 tracking-tight">
                  {c.value}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {c.label}
                </p>
              </div>
              {c.href && (
                <Link
                  href={c.href}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066cc] hover:underline pt-1"
                >
                  <span>View records</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </Card>
          );
        })}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {statCards.slice(4).map((c, i) => {
          const Icon = c.icon;
          return (
            <Card
              key={i}
              className={`rounded-3xl border ${c.border} bg-white p-6 shadow-xs space-y-3`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">
                  {c.value}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {c.label}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

