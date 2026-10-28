'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Doctor } from '@/types';
import { DoctorAvatar } from '@/components/common/DoctorAvatar';
import { SPECIALIZATION_LABELS } from '@/lib/constants';

interface DoctorCardProps {
  doctor: Doctor;
  index?: number;
  featured?: boolean;
}

export function DoctorCard({ doctor, index = 0 }: DoctorCardProps) {
  const specLabel = SPECIALIZATION_LABELS[doctor.specialization] || doctor.specialization;
  const roomNumber = (index % 6) + 1;
  const experienceYears = doctor.experience ? `${doctor.experience} years in practice` : 'Experienced physician';
  const qualification = doctor.qualification || 'MRCGP';

  // Map room & schedule days
  const clinicDays = index === 3 ? 'Tuesday and Thursday' : 'Monday to Friday';
  const languages = index === 0 ? 'English, Yoruba' : index === 2 ? 'English, Korean' : index === 3 ? 'English, Urdu, Bengali' : 'English';

  return (
    <article className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <div>
        {/* Top Header: Avatar + Info */}
        <div className="flex items-start gap-4">
          <DoctorAvatar
            name={doctor.fullName}
            size="md"
            index={index}
            className="rounded-2xl border border-slate-100 shadow-2xs"
          />

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0066cc] transition-colors truncate">
              {doctor.fullName}
            </h3>

            {/* Specialty Pill Tag */}
            <div className="mt-1">
              <span className="inline-block rounded-full bg-[#e8f2fe] px-2.5 py-0.5 text-[11px] font-semibold text-[#0066cc]">
                {specLabel}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {qualification} · {experienceYears}
            </p>
          </div>
        </div>

        {/* Doctor Bio */}
        <p className="mt-3.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {doctor.profileDetails ||
            'Senior partner at the practice. Happy to see anything, from a new worry to a long-running condition.'}
        </p>

        {/* Doctor languages & Clinic room info */}
        <div className="mt-3 space-y-0.5 text-xs text-slate-500">
          <p>
            <span className="font-medium text-slate-600">Speaks:</span> {languages}
          </p>
          <p>
            <span className="font-medium text-slate-600">In clinic:</span> {clinicDays} · Room {roomNumber}
          </p>
        </div>
      </div>

      {/* Footer: Availability indicator + See Times CTA */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            Next available <strong className="font-semibold text-slate-900">{index % 2 === 0 ? 'Today, 09:20' : 'Tomorrow, 09:10'}</strong>
          </span>
        </div>

        <Link
          href={`/doctors/${doctor.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066cc] transition-colors hover:text-[#004494] hover:underline"
        >
          <span>See times</span>
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
