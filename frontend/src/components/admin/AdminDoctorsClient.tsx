'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Filter,
  Eye,
  Shield,
  Stethoscope,
} from 'lucide-react';

interface AdminDoctorsClientProps {
  initialDoctors: any[];
  initialMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  initialStatus?: string;
  initialSearch?: string;
}

export function AdminDoctorsClient({
  initialDoctors,
  initialMeta,
  initialStatus = '',
  initialSearch = '',
}: AdminDoctorsClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);

  const handleFilterChange = (status: string) => {
    setSelectedStatus(status);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (searchTerm) params.set('search', searchTerm);
    router.push(`/admin/doctors?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedStatus) params.set('status', selectedStatus);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    router.push(`/admin/doctors?${params.toString()}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300/80 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Pending Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
      case 'RESUBMISSION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200/80 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            Resubmission
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-slate-100 border border-slate-700 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Not Submitted
          </span>
        );
    }
  };

  const filterTabs = [
    { label: 'All Doctors', value: '' },
    { label: 'Pending Review', value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'Resubmission', value: 'RESUBMISSION_REQUIRED' },
    { label: 'Suspended', value: 'SUSPENDED' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#0066cc] border border-blue-100">
            <Shield className="w-3.5 h-3.5" />
            <span>Practitioner Verification Directory</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Doctor Verifications & Compliance
          </h1>
          <p className="text-sm text-slate-500">
            Review qualifications, verify state medical council licenses, and manage clinical permissions.
          </p>
        </div>
        <div className="text-xs text-slate-600 font-bold bg-slate-100/80 border border-slate-200/80 px-4 py-2.5 rounded-2xl shrink-0 self-start md:self-auto">
          Showing <span className="text-slate-900">{initialDoctors.length}</span> of <span className="text-slate-900">{initialMeta.total}</span> doctors
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by name, email, or registration #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-24 rounded-2xl text-sm h-11 bg-white border-slate-200 shadow-2xs focus-visible:ring-[#0066cc]"
          />
          <Button
            type="submit"
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 text-xs font-bold rounded-xl bg-[#0066cc] hover:bg-[#0052a3] text-white shadow-xs transition-colors"
          >
            Search
          </Button>
        </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleFilterChange(tab.value)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                selectedStatus === tab.value
                  ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Doctors Table */}
      {initialDoctors.length === 0 ? (
        <Card className="p-14 text-center rounded-3xl border border-slate-200/80 bg-white space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No Doctors Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No practitioner records matched your filter criteria. Try clearing the filter or searching with another term.
          </p>
        </Card>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-4 px-6">Doctor Details</th>
                  <th className="py-4 px-6">Specialization</th>
                  <th className="py-4 px-6">Registration #</th>
                  <th className="py-4 px-6">Verification Status</th>
                  <th className="py-4 px-6">Registered On</th>
                  <th className="py-4 px-6 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialDoctors.map((doc) => {
                  const vStatus = doc.verification?.status || 'NOT_SUBMITTED';
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-[#0066cc] font-extrabold flex items-center justify-center text-sm border border-blue-200/60 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                            {doc.fullName?.replace('Dr.', '').trim()[0] || 'D'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">
                              {doc.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{doc.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 font-semibold text-slate-700 capitalize">
                        {doc.specialization}
                      </td>

                      <td className="py-4 px-6 font-mono font-medium text-slate-700">
                        {doc.verification?.medicalRegistrationNumber ? (
                          <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">
                            {doc.verification.medicalRegistrationNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-4 px-6">{getStatusBadge(vStatus)}</td>

                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {new Date(doc.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <Link href={`/admin/doctors/${doc.id}`}>
                          <Button
                            type="button"
                            variant="outline"
                            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300/80 hover:bg-[#0066cc] hover:text-white hover:border-[#0066cc] shadow-2xs transition-all duration-200 cursor-pointer active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Profile</span>
                            <ArrowRight className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
