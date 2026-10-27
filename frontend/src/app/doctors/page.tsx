import React from 'react';
import Link from 'next/link';
import { getDoctors } from '@/lib/api/doctors';
import { getSession } from '@/lib/auth/session';
import { Navbar } from '@/components/common/Navbar';
import { SPECIALIZATIONS, SPECIALIZATION_LABELS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  Stethoscope,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface DoctorsPageProps {
  searchParams: Promise<{
    search?: string;
    specialization?: string;
    availability?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function DoctorsPage({ searchParams }: DoctorsPageProps) {
  const { user } = await getSession();
  const params = await searchParams;

  const search = params.search || '';
  const specialization = params.specialization || '';
  const availability = params.availability || '';
  const page = parseInt(params.page || '1', 10);
  const limit = parseInt(params.limit || '8', 10);

  let doctors: any[] = [];
  let meta = { page: 1, limit: 8, total: 0, totalPages: 1 };
  let fetchError: string | null = null;

  try {
    const res = await getDoctors({
      search: search || undefined,
      specialization: specialization || undefined,
      availability: availability || undefined,
      page,
      limit,
    });
    doctors = res.data || [];
    meta = res.meta || { page, limit, total: doctors.length, totalPages: 1 };
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : 'Failed to connect to doctors directory';
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background, #f8fafb)' }}>
      <Navbar user={user} />

      <main className="page-container flex-1 py-10 sm:py-12">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 pb-8 sm:flex-row sm:items-end">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Medical Directory
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Find Your Specialist
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Compare qualifications, fees, and real-time open slots across verified practitioners.
            </p>
          </div>

          <div className="text-right text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
              {meta.total} doctors found
            </span>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-8" />

        {/* Filter Bar */}
        <div className="card p-5 animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <form method="GET" action="/doctors" className="grid gap-3 sm:grid-cols-12">
            <div className="relative sm:col-span-5">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by doctor name..."
                className="field-input pl-10"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                name="specialization"
                defaultValue={specialization}
                className="field-input capitalize"
              >
                <option value="">All Specializations</option>
                {SPECIALIZATIONS.map((spec) => (
                  <option key={spec} value={spec}>
                    {SPECIALIZATION_LABELS[spec]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 sm:col-span-3">
              <button type="submit" className="btn-primary flex-1">
                <Filter className="h-4 w-4" />
                Apply
              </button>
              {(search || specialization) && (
                <Link
                  href="/doctors"
                  className="btn-secondary px-3 py-2.5 text-xs"
                  title="Clear filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </form>

          {/* Quick Specialty Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3.5 text-xs">
            <span className="font-semibold text-slate-400 mr-1 uppercase tracking-wider text-[10px]">Quick:</span>
            {SPECIALIZATIONS.slice(0, 6).map((spec) => {
              const active = specialization === spec;
              return (
                <Link
                  key={spec}
                  href={`/doctors?specialization=${encodeURIComponent(spec)}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                    active
                      ? 'text-white font-semibold shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                  style={active ? { background: 'linear-gradient(135deg, #2563eb, #0284c7)' } : undefined}
                >
                  {SPECIALIZATION_LABELS[spec]}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {fetchError ? (
          <div className="mt-8 card p-8 text-center animate-scale-in">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <Stethoscope className="h-6 w-6" />
            </div>
            <p className="mt-4 font-bold text-slate-900">{fetchError}</p>
            <p className="mt-1 text-xs text-slate-500">
              Please ensure your backend service is running and accessible.
            </p>
            <Link href="/doctors" className="btn-secondary mt-5 inline-flex text-xs">
              Retry Query
            </Link>
          </div>
        ) : doctors.length === 0 ? (
          <div className="card mt-8 p-12 text-center animate-scale-in">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">No doctors found</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              Try a different search or select &quot;All Specializations&quot;.
            </p>
            <Link href="/doctors" className="btn-secondary mt-5 inline-flex text-xs">
              Clear All Filters
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {doctors.map((doc, i) => (
              <article
                key={doc.id}
                className={`card-hover flex flex-col justify-between p-6 animate-fade-up stagger-${Math.min(i + 1, 6)}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)' }}>
                      {doc.fullName?.charAt(0) || 'D'}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/50">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  </div>

                  <h2 className="mt-4 text-base font-bold text-slate-900 truncate">
                    {doc.fullName}
                  </h2>
                  <p className="text-xs font-semibold text-blue-600 capitalize mt-0.5">
                    {SPECIALIZATION_LABELS[doc.specialization] || doc.specialization}
                  </p>
                  {doc.qualification && (
                    <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                      {doc.qualification}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                    <div className="rounded-xl p-2.5" style={{ background: 'linear-gradient(135deg, #f8fafb, #f1f5f9)' }}>
                      <span className="text-[9px] text-slate-400 block font-semibold uppercase tracking-wider">Experience</span>
                      <span className="font-bold text-slate-800">{doc.experience} Years</span>
                    </div>
                    <div className="rounded-xl p-2.5" style={{ background: 'linear-gradient(135deg, #f8fafb, #f1f5f9)' }}>
                      <span className="text-[9px] text-slate-400 block font-semibold uppercase tracking-wider">Fee (INR)</span>
                      <span className="font-bold text-slate-900">{formatCurrency(doc.consultationFee)}</span>
                    </div>
                  </div>

                  {doc.profileDetails && (
                    <p className="mt-3 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {doc.profileDetails}
                    </p>
                  )}
                </div>

                <Link
                  href={`/doctors/${doc.id}`}
                  className="btn-primary mt-5 w-full py-2.5 text-xs"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Book Consultation
                </Link>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Link
                href={`/doctors?page=${page - 1}&search=${encodeURIComponent(search)}&specialization=${encodeURIComponent(specialization)}`}
                className="btn-secondary p-2.5"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span className="rounded-xl border border-slate-200 p-2.5 text-slate-300">
                <ChevronLeft className="h-4 w-4" />
              </span>
            )}

            <span className="text-xs font-semibold text-slate-600 px-3">
              Page {meta.page} of {meta.totalPages}
            </span>

            {page < meta.totalPages ? (
              <Link
                href={`/doctors?page=${page + 1}&search=${encodeURIComponent(search)}&specialization=${encodeURIComponent(specialization)}`}
                className="btn-secondary p-2.5"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="rounded-xl border border-slate-200 p-2.5 text-slate-300">
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
