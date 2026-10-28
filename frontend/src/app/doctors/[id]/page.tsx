import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDoctorById } from '@/lib/api/doctors';
import { getSession } from '@/lib/auth/session';
import { Navbar } from '@/components/common/Navbar';
import { DoctorBookingClient } from '@/components/booking/DoctorBookingClient';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';
import { SPECIALIZATION_LABELS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import {
  Award,
  Briefcase,
  ChevronLeft,
  GraduationCap,
  Clock,
  Sparkles,
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
    <div className="flex min-h-screen flex-col bg-[#f6f8fb] text-slate-900">
      <Navbar user={user} />

      <main className="page-container flex-1 py-8 sm:py-12">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/doctors"
            className="group inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0066cc] transition-colors"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 group-hover:border-[#0066cc] group-hover:text-[#0066cc] transition-all shadow-2xs">
              <ChevronLeft className="h-4 w-4" />
            </span>
            Back to doctors
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: Doctor Profile Card */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
              {/* Doctor header */}
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="relative">
                  <DoctorAvatar name={doctor.fullName} size="lg" className="rounded-2xl border border-slate-100 shadow-2xs" />
                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-[#e8f2fe] px-2.5 py-0.5 text-[11px] font-semibold text-[#0066cc] mb-1.5">
                    {specLabel}
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {doctor.fullName}
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">
                    {doctor.qualification} · {doctor.experience} years in practice
                  </p>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 mt-6">
                <div className="rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Briefcase className="h-3.5 w-3.5 text-[#0066cc]" />
                    Experience
                  </div>
                  <span className="text-lg font-bold text-slate-900">
                    {doctor.experience}+ <span className="text-xs font-normal text-slate-500">years</span>
                  </span>
                </div>

                <div className="rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Award className="h-3.5 w-3.5 text-[#0066cc]" />
                    Consultation
                  </div>
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(doctor.consultationFee)}
                  </span>
                </div>
              </div>

              {/* Qualifications */}
              <div className="mt-6 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Qualifications & Degree
                </h3>
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5 text-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f2fe] text-[#0066cc]">
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    About the Doctor
                  </h3>
                  <div className="rounded-xl border border-slate-100 bg-[#f8fafc] p-4 text-xs leading-relaxed text-slate-600">
                    <p className="whitespace-pre-line">{doctor.profileDetails}</p>
                  </div>
                </div>
              )}

              {/* Live Queue Notice */}
              <div className="mt-6 rounded-xl border border-slate-100 bg-[#f8fafc] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f2fe] text-[#0066cc]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <span className="font-bold text-slate-900 block">Outpatient Visit Details</span>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Standard consultation length is 10–15 minutes. Check in at the desk or monitor live queue tokens on your phone.
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
