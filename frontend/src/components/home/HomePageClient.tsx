'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { LandingHero } from '@/components/home/LandingHero';
import { LandingLogoMarquee } from '@/components/home/LandingLogoMarquee';
import { MedicalBackgroundPatterns } from '@/components/common/MedicalBackgroundPatterns';
import { SmoothScroll } from '@/components/common/SmoothScroll';
import { SessionUser } from '@/types';

const LandingShowcase = dynamic(
  () => import('@/components/home/LandingShowcase').then((m) => m.LandingShowcase),
  { ssr: true },
);
const LandingSmartTools = dynamic(
  () => import('@/components/home/LandingSmartTools').then((m) => m.LandingSmartTools),
  { ssr: true },
);
const LandingRoleTabs = dynamic(
  () => import('@/components/home/LandingRoleTabs').then((m) => m.LandingRoleTabs),
  { ssr: true },
);
const HomeDoctorDirectory = dynamic(
  () => import('@/components/common/HomeDoctorDirectory').then((m) => m.HomeDoctorDirectory),
  { ssr: true },
);
const LandingTrustBadges = dynamic(
  () => import('@/components/home/LandingTrustBadges').then((m) => m.LandingTrustBadges),
  { ssr: true },
);

interface HomePageClientProps {
  user?: SessionUser | null;
  doctors: any[];
}

export function HomePageClient({ user, doctors }: HomePageClientProps) {
  return (
    <div className="relative flex min-h-screen flex-col text-slate-900 selection:bg-sky-100 selection:text-sky-900 bg-white">
      <SmoothScroll />
      <MedicalBackgroundPatterns />
      <Navbar user={user} />

      <main className="flex-1">
        <LandingHero user={user} />
        <LandingShowcase />
        <LandingSmartTools />
        <LandingRoleTabs />

        <section
          id="doctors-section"
          className="py-20 lg:py-28 bg-white"
        >
          <div className="page-container space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
                VERIFIED GENERAL PRACTITIONERS & SPECIALISTS
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                Choose a doctor, pick a time, and go.
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm">
                Each practitioner with transparent consulting slots, qualifications, and live room assignment.
              </p>
            </div>

            <HomeDoctorDirectory initialDoctors={doctors} />
          </div>
        </section>

        <LandingTrustBadges />
        <LandingLogoMarquee />
      </main>

      <Footer />
    </div>
  );
}
