import React from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Lock,
  Clock,
  UserCheck,
  Check,
  Phone,
  Stethoscope,
} from 'lucide-react';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { getSession } from '@/lib/auth/session';
import { getDoctors } from '@/lib/api/doctors';
import { HeroNetworkGraphic } from '@/components/common/HeroNetworkGraphic';
import { HomeDoctorDirectory } from '@/components/common/HomeDoctorDirectory';
import { MedicalBackgroundPatterns } from '@/components/common/MedicalBackgroundPatterns';

export const dynamic = 'force-dynamic';

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
    <div className="relative flex min-h-screen flex-col bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* ── Background Subtle DNA Strands & Molecular Patterns (Left & Right Edges) ── */}
      <MedicalBackgroundPatterns />

      {/* ── Header / Navbar ── */}
      <Navbar user={user} />

      <main className="flex-1">
        {/* ═══════════════ HERO SECTION ═══════════════ */}
        <section className="relative overflow-hidden py-10 sm:py-14 lg:py-18">
          <div className="page-container">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              {/* Left Column: Interactive Network Graphic (Doctor/Patient Satellite Nodes + Connecting Lines) */}
              <div className="lg:col-span-5 order-2 lg:order-1">
                <HeroNetworkGraphic />
              </div>

              {/* Right Column: Hero Headline, Subtitle, CTAs & Badges */}
              <div className="lg:col-span-7 order-1 lg:order-2 space-y-6 text-left">
                {/* Brand / Platform Pill */}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#f8fafc] px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-[#0066cc]" />
                  <span>CareUp Healthcare Network</span>
                </div>

                {/* Bold Headline */}
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] leading-[1.12]">
                  Book your GP in under a minute.
                </h1>

                {/* Subtitle */}
                <p className="text-base sm:text-lg leading-relaxed text-slate-600 max-w-xl">
                  Choose one of our doctors, pick a time that suits you and get a calendar invite. No phone queue at 8am.
                </p>

                {/* Two Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <Link
                    href="/doctors"
                    className="btn-primary px-6 py-3 text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Book an appointment
                  </Link>

                  <Link
                    href={user ? (user.role === 'DOCTOR' ? '/doctor/dashboard' : '/patient/dashboard') : '/patient/dashboard'}
                    className="btn-secondary px-6 py-3 text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2"
                  >
                    Go to dashboard
                  </Link>
                </div>

                {/* 4 Trust-Check Badges (2x2 Grid) */}
                <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#18794e] text-white shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span>Pay online or at the desk</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#18794e] text-white shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span>Book up to 4 weeks ahead</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#18794e] text-white shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span>Same day until 16:00</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#18794e] text-white shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span>Cancel online any time</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ HOW IT WORKS SECTION ═══════════════ */}
        <section id="how-it-works" className="py-14 sm:py-20 border-t border-slate-100 bg-white/70 backdrop-blur-xs">
          <div className="page-container space-y-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
                HOW IT WORKS
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Four steps. That’s it.
              </h2>
            </div>

            {/* 4 Horizontal Step Cards with Number Tag */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Step 1 */}
              <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                <span className="absolute top-4 right-5 text-3xl font-extrabold text-slate-200 select-none">
                  1
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f2fe] text-[#0066cc]">
                  <Lock className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">Sign in</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Use your patient account, or create one in a minute.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                <span className="absolute top-4 right-5 text-3xl font-extrabold text-slate-200 select-none">
                  2
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f2fe] text-[#0066cc]">
                  <UserCheck className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">Choose a doctor</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  See who&apos;s in, what they focus on and when they&apos;re free.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                <span className="absolute top-4 right-5 text-3xl font-extrabold text-slate-200 select-none">
                  3
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f2fe] text-[#0066cc]">
                  <Clock className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">Pick a time</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Tap a time in the next four weeks. We hold it while you finish.
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
                <span className="absolute top-4 right-5 text-3xl font-extrabold text-slate-200 select-none">
                  4
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f2fe] text-[#0066cc]">
                  <Check className="h-4 w-4 stroke-[2.5]" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">You&apos;re booked</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Get a reference and a calendar invite. Cancel online if plans change.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ OUR TEAM / DOCTORS DIRECTORY ═══════════════ */}
        <section id="doctors-section" className="py-14 sm:py-20 border-t border-slate-100 bg-[#f8fafc]/60">
          <div className="page-container space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
                OUR TEAM
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Meet our doctors
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-2xl">
                Five GPs, each with something they&apos;re especially good at. Pick the one that fits, then choose a time.
              </p>
            </div>

            {/* Interactive Doctor Directory with Doctor Cards + Featured Card (Dr. Adeyemi) */}
            <HomeDoctorDirectory initialDoctors={doctors} />
          </div>
        </section>

        {/* ═══════════════ GOOD TO KNOW SECTION ═══════════════ */}
        <section id="good-to-know" className="py-14 sm:py-20 border-t border-slate-100 bg-white">
          <div className="page-container space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Good to know
              </h2>
            </div>

            {/* 3 Information Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900">Same-day visits</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Book online until 16:00. After that, call the desk.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900">Visit length</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  10 or 15 minutes, depending on the reason for your visit.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900">New patients</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Register with the practice by phone first. Online booking is for registered patients.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
