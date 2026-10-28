import React from 'react';
import Link from 'next/link';
import { getDoctors } from '@/lib/api/doctors';
import { getSession } from '@/lib/auth/session';
import { Navbar } from '@/components/common/Navbar';
import { DoctorCard } from '@/components/common/DoctorCard';
import { SPECIALIZATIONS, SPECIALIZATION_LABELS } from '@/lib/constants';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
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
    <div className="flex min-h-screen flex-col bg-[#f6f8fb] text-slate-900">
      <Navbar user={user} />

      <main className="page-container flex-1 py-10 sm:py-16">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 pb-8 sm:flex-row sm:items-end border-b border-slate-200/80 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
              <Sparkles className="h-3 w-3 text-[#0066cc]" />
              <span>CAREUP CLINICAL TEAM</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Meet our doctors
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-xl">
              Verified general practitioners and specialists. Select a physician to view schedules and secure real-time appointment slots.
            </p>
          </div>

          <div className="text-right text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 font-semibold text-slate-800 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{meta.total} {meta.total === 1 ? 'physician' : 'physicians'} available</span>
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs mb-8">
          <form method="GET" action="/doctors" className="grid gap-3 sm:grid-cols-12">
            <div className="relative sm:col-span-5">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by physician name or specialty"
                className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/10 transition-all shadow-2xs"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                name="specialization"
                defaultValue={specialization}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#0066cc] focus:outline-none capitalize transition-all shadow-2xs"
              >
                <option value="">All Specialties</option>
                {SPECIALIZATIONS.map((spec) => (
                  <option key={spec} value={spec} className="bg-white text-slate-900">
                    {SPECIALIZATION_LABELS[spec]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 sm:col-span-3">
              <button type="submit" className="btn-primary flex-1 py-2.5 text-xs">
                <Filter className="h-3.5 w-3.5" />
                Filter Slots
              </button>
              {(search || specialization) && (
                <Link
                  href="/doctors"
                  className="btn-secondary px-3.5 py-2.5 text-xs"
                  title="Clear filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </form>

          {/* Quick Specialty Filter Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs">
            <Link
              href="/doctors"
              className={!specialization ? 'pill-filter-active' : 'pill-filter-idle'}
            >
              All doctors
            </Link>
            {SPECIALIZATIONS.slice(0, 6).map((spec) => {
              const active = specialization === spec;
              return (
                <Link
                  key={spec}
                  href={`/doctors?specialization=${encodeURIComponent(spec)}`}
                  className={active ? 'pill-filter-active' : 'pill-filter-idle'}
                >
                  {SPECIALIZATION_LABELS[spec]}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {fetchError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-8 text-center backdrop-blur-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <Stethoscope className="h-6 w-6" />
            </div>
            <p className="mt-3 font-bold text-zinc-900">{fetchError}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Please ensure your backend service is running and accessible.
            </p>
            <Link href="/doctors" className="btn-secondary mt-4 inline-flex text-xs">
              Retry Query
            </Link>
          </div>
        ) : doctors.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">No doctors found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search criteria or click &quot;All doctors&quot; to reset.
            </p>
            <Link href="/doctors" className="btn-secondary mt-4 inline-flex text-xs">
              Clear All Filters
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {doctors.map((doc, i) => (
              <DoctorCard key={doc.id} doctor={doc} index={i} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Link
                href={`/doctors?page=${page - 1}&search=${encodeURIComponent(search)}&specialization=${encodeURIComponent(specialization)}`}
                className="btn-secondary px-4 py-2 text-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span className="btn-secondary px-4 py-2 text-xs opacity-40 cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
                Previous
              </span>
            )}

            <span className="text-xs font-semibold text-slate-600">
              Page {page} of {meta.totalPages}
            </span>

            {page < meta.totalPages ? (
              <Link
                href={`/doctors?page=${page + 1}&search=${encodeURIComponent(search)}&specialization=${encodeURIComponent(specialization)}`}
                className="btn-secondary px-4 py-2 text-xs"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="btn-secondary px-4 py-2 text-xs opacity-40 cursor-not-allowed">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
