import React from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { getSession } from '@/lib/auth/session';
import { getDoctors } from '@/lib/api/doctors';
import { LandingHero } from '@/components/home/LandingHero';
import { LandingLogoMarquee } from '@/components/home/LandingLogoMarquee';
import { MedicalBackgroundPatterns } from '@/components/common/MedicalBackgroundPatterns';
import { SmoothScroll } from '@/components/common/SmoothScroll';

// Dynamic code-split imports for below-the-fold sections to maximize Lighthouse Performance (FCP/LCP/TBT)
const LandingShowcase = dynamic(
  () => import('@/components/home/LandingShowcase').then((m) => m.LandingShowcase),
  { ssr: true },
);
const LandingFeaturesGrid = dynamic(
  () => import('@/components/home/LandingFeaturesGrid').then((m) => m.LandingFeaturesGrid),
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
const LandingCta = dynamic(
  () => import('@/components/home/LandingCta').then((m) => m.LandingCta),
  { ssr: true },
);

export default async function HomePage() {
  const { user } = await getSession();

  let doctors: any[] = [];
  try {
    const res = await getDoctors({ limit: 12 });
    doctors = res.data || [];
  } catch {
    doctors = [];
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-white text-slate-900 selection:bg-sky-100 selection:text-sky-900">
      {/* Locomotive / Lenis Hardware Accelerated Smooth Scrolling */}
      <SmoothScroll />

      {/* Lightweight GPU-Accelerated Medical Ambient Background */}
      <MedicalBackgroundPatterns />

      {/* Main Navigation Bar */}
      <Navbar user={user} />

      <main className="flex-1">
        {/* 1. Hero Section: Brevo-style curved container with CareUp Clinical Sky-Blue Theme */}
        <LandingHero user={user} />

        {/* 2. Logo / Social Proof Marquee */}
        <LandingLogoMarquee />

        {/* 3. Interactive Split Showcase (Zero-Wait Live Queue Engine) */}
        <LandingShowcase />

        {/* 4. Omnichannel Touchpoint Grid (6 Brevo-Style Channel Cards) */}
        <LandingFeaturesGrid />

        {/* 5. Intelligent Care Tools (Pacing Estimator & Specialty Matcher) */}
        <LandingSmartTools />

        {/* 6. Role-Based Tabbed Explorer (For Patients, Doctors & Clinics) */}
        <LandingRoleTabs />

        {/* 7. Practice Doctors Directory (Search, Specialty Filter & Real Booking) */}
        <section id="doctors-section" className="py-20 lg:py-28 bg-[#f8fbff] border-b border-slate-100">
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

            {/* Interactive Doctor Directory with Real Data & Realistic Practice Doctors */}
            <HomeDoctorDirectory initialDoctors={doctors} />
          </div>
        </section>

        {/* 8. Trust, Security & Compliance Badges */}
        <LandingTrustBadges />

        {/* 9. Grand Bottom Curved CTA Banner */}
        <LandingCta />
      </main>

      {/* Modern Multi-Column Footer */}
      <Footer />
    </div>
  );
}
