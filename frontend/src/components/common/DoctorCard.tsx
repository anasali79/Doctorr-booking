'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const experienceYears = doctor.experience ? `${doctor.experience} years in practice` : 'Experienced physician';
  const qualification = doctor.qualification || 'Medical Specialist';
  const fee = typeof doctor.consultationFee === 'number' && doctor.consultationFee > 0 ? `₹${doctor.consultationFee}` : null;

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
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0066cc] transition-colors truncate">
                {doctor.fullName}
              </h3>
              {doctor.isVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-2xs">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                  <span>Unverified</span>
                </span>
              )}
            </div>

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
            'Experienced medical practitioner committed to providing high quality clinical care and patient-first consultations.'}
        </p>

        {/* Doctor Details */}
        <div className="mt-3 space-y-1 text-xs text-slate-500">
          {fee && (
            <p>
              <span className="font-medium text-slate-600">Consultation Fee:</span>{' '}
              <span className="font-semibold text-slate-900">{fee}</span>
            </p>
          )}
          {doctor.clinicRoom ? (
            <p>
              <span className="font-medium text-slate-600">Room:</span> {doctor.clinicRoom}
            </p>
          ) : null}
          {doctor.languages && doctor.languages.length > 0 ? (
            <p>
              <span className="font-medium text-slate-600">Speaks:</span> {doctor.languages.join(', ')}
            </p>
          ) : null}
        </div>
      </div>

      {/* Footer: Availability indicator + See Times CTA */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            {doctor.nextAvailableSlot ? (
              <>Next available <strong className="font-semibold text-slate-900">{doctor.nextAvailableSlot}</strong></>
            ) : (
              <span className="font-medium text-emerald-700">Available for booking</span>
            )}
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
