import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDoctorById } from '@/lib/api/doctors';
import { getSession } from '@/lib/auth/session';
import { Navbar } from '@/components/common/Navbar';
import { DoctorBookingClient } from '@/components/booking/DoctorBookingClient';
import { SPECIALIZATION_LABELS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import {
  Award,
  Briefcase,
  ChevronLeft,
  GraduationCap,
  HeartHandshake,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface DoctorProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function DoctorProfilePage({ params }: DoctorProfilePageProps) {
  const { id } = await params;
  const { user } = await getSession();

  let doctor = null;
  try {
    const res = await getDoctorById(id);
    doctor = res.data;
  } catch {
    notFound();
  }

  if (!doctor) {
    notFound();
  }

  const specLabel = SPECIALIZATION_LABELS[doctor.specialization] || doctor.specialization;

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-slate-900 selection:bg-blue-500/20 selection:text-blue-900">
      <Navbar user={user} />

      {/* Subtle top ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-0 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute top-60 -left-20 h-96 w-96 rounded-full bg-sky-500/5 blur-3xl" />
      </div>

      <main className="page-container flex-1 py-8 sm:py-10">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/doctors"
            className="group inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-700 transition-colors"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-2xs group-hover:border-blue-300 group-hover:text-blue-700 transition-all">
              <ChevronLeft className="h-4 w-4" />
            </span>
            Back to Specialists Directory
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: Doctor Profile Card */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]">
              {/* Doctor header badge */}
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="relative">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-3xl font-extrabold text-white shadow-lg shadow-blue-700/20 ring-4 ring-blue-50">
                    {doctor.fullName?.charAt(0) || 'D'}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white shadow-xs"
                    title="Verified Practitioner"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                    <Sparkles className="h-3 w-3 text-blue-600" />
                    Verified Clinician
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {doctor.fullName}
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm font-semibold text-blue-700 flex items-center gap-1.5 capitalize">
                    <Stethoscope className="h-3.5 w-3.5" />
                    {specLabel}
                  </p>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 mt-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                    Experience
                  </div>
                  <span className="text-lg font-bold text-slate-900">
                    {doctor.experience}+ <span className="text-xs font-normal text-slate-500">years</span>
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Award className="h-3.5 w-3.5 text-emerald-600" />
                    Consultation Fee
                  </div>
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(doctor.consultationFee)}
                  </span>
                </div>
              </div>

              {/* Qualifications */}
              <div className="mt-6 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Qualifications & Degree
                </h3>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">{doctor.qualification}</span>
                    <p className="text-[11px] text-slate-500">Certified Medical Practitioner</p>
                  </div>
                </div>
              </div>

              {/* About Profile */}
              {doctor.profileDetails && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    About the Doctor
                  </h3>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-xs leading-relaxed text-slate-600">
                    <p className="whitespace-pre-line">{doctor.profileDetails}</p>
                  </div>
                </div>
              )}

              {/* Real-Time Live Queue Information */}
              <div className="mt-6 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/80 to-sky-50/50 p-4 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-950">Live Smart Queue</span>
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <p className="text-[11px] leading-relaxed text-blue-900/80">
                      On confirmed booking, you get an official token number. Track doctor queue position & wait time directly from your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Slot Picker and Booking flow */}
          <div className="lg:col-span-7">
            <DoctorBookingClient doctor={doctor} user={user} />
          </div>
        </div>
      </main>
    </div>
  );
}
