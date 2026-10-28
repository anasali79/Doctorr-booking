'use client';

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Doctor } from '@/types';
import { DoctorCard } from '@/components/common/DoctorCard';
import { FeaturedDoctorCard } from '@/components/common/FeaturedDoctorCard';

interface HomeDoctorDirectoryProps {
  initialDoctors: Doctor[];
}

export function HomeDoctorDirectory({ initialDoctors }: HomeDoctorDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Realistic practice doctors matching user's image (rahul, rahul, rajuu)
  const defaultPracticeDoctors: Doctor[] = [
    {
      id: 'doc-rahul-1',
      userId: 'u1',
      fullName: 'rahol',
      specialization: 'Psychiatrist',
      experience: 1,
      qualification: 'MBBS, MD',
      consultationFee: 700,
      profileDetails:
        'Senior partner at the practice. Happy to see anything, from new worry to a long-running condition.',
      allowFutureBooking: true,
    },
    {
      id: 'doc-rahul-2',
      userId: 'u2',
      fullName: 'rahul',
      specialization: 'General Physician',
      experience: 5,
      qualification: 'MRCGP',
      consultationFee: 850,
      profileDetails:
        'Senior partner at the practice. Happy to see anything, from new worry to a long-running condition.',
      allowFutureBooking: true,
    },
    {
      id: 'doc-rajuu',
      userId: 'u3',
      fullName: 'rajuu',
      specialization: 'Cardiologist',
      experience: 1,
      qualification: 'MBBS, MD',
      consultationFee: 900,
      profileDetails:
        'Senior partner at the practice. Happy to see anything, from new worry to a long-running condition.',
      allowFutureBooking: true,
    },
  ];

  // If initialDoctors has real backend doctors, use them, otherwise use default
  const baseDoctors = initialDoctors.length > 0 ? initialDoctors : defaultPracticeDoctors;

  const filterTabs = [
    { key: 'ALL', label: 'All doctors' },
    { key: 'General practice', label: 'General practice' },
    { key: 'Diabetes', label: 'Diabetes' },
    { key: 'Women’s health', label: 'Women’s health' },
    { key: 'Joint injections', label: 'Joint injections' },
    { key: 'GP registrar', label: 'GP registrar' },
  ];

  const filteredDoctors = useMemo(() => {
    return baseDoctors.filter((doc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        doc.fullName.toLowerCase().includes(q) ||
        doc.specialization.toLowerCase().includes(q) ||
        (doc.qualification && doc.qualification.toLowerCase().includes(q)) ||
        (doc.profileDetails && doc.profileDetails.toLowerCase().includes(q));

      const matchFilter =
        activeFilter === 'ALL' ||
        doc.specialization.toLowerCase().includes(activeFilter.toLowerCase()) ||
        (activeFilter === 'General practice' && doc.specialization.toLowerCase().includes('general'));

      return matchSearch && matchFilter;
    });
  }, [baseDoctors, searchQuery, activeFilter]);

  return (
    <div id="doctors" className="space-y-4">
      {/* ── Search Input Pill ── */}
      <div className="relative max-w-xl w-full">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Name, specialty or language"
          className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066cc] focus:outline-none focus:ring-2 focus:ring-[#0066cc]/10 transition-all shadow-2xs"
        />
      </div>

      {/* ── Specialty Filter Pills ── */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={
                isActive
                  ? 'rounded-full bg-[#18191f] px-4 py-1.5 text-xs font-semibold text-white transition-all shadow-xs'
                  : 'rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50'
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Doctor Count ── */}
      <div className="pt-2 text-xs text-slate-500">
        <span>3 doctors</span>
      </div>

      {/* ── Doctors Grid with 3 Doctor Cards + 1 Featured Card (Matching User Image) ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredDoctors.map((doc, idx) => (
          <DoctorCard key={doc.id} doctor={doc} index={idx} />
        ))}

        {/* 4th Slot: Highlighted Featured Doctor Card (Dr. Adeyemi) */}
        <FeaturedDoctorCard />
      </div>
    </div>
  );
}
