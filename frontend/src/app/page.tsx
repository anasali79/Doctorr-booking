import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Search,
  Stethoscope,
  ShieldCheck,
  Clock,
  Activity,
  Users,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  UserCheck,
  Zap,
  Heart,
} from 'lucide-react';
import { Navbar } from '@/components/common/Navbar';
import { getSession } from '@/lib/auth/session';
import { SPECIALIZATIONS, SPECIALIZATION_LABELS } from '@/lib/constants';
import { getDoctors } from '@/lib/api/doctors';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { user } = await getSession();

  let featuredDoctors: any[] = [];
  try {
    const res = await getDoctors({ limit: 4 });
    featuredDoctors = res.data || [];
  } catch {
    featuredDoctors = [];
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--background)' }}>
      <Navbar user={user} />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden bg-white">
        {/* Multi-layer ambient background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent)]" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(14,165,233,0.06),transparent_70%)]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(99,102,241,0.04),transparent_70%)]" />
        </div>

        <div className="page-container py-16 sm:py-24 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            {/* Left Column */}
            <div className="text-center lg:col-span-7 lg:text-left animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/80 px-4 py-1.5 text-xs font-semibold text-blue-800 shadow-sm backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
                </span>
                Real-Time Queue Intelligence
              </div>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12] lg:text-[3.5rem]">
                Skip the wait.
                <br />
                <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 bg-clip-text text-transparent animate-gradient" style={{ backgroundSize: '200% auto' }}>
                  Book smart.
                </span>
              </h1>

              <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-500 max-w-xl">
                Guaranteed time slots with verified doctors. Live token tracking so you arrive exactly when it&apos;s your turn.
              </p>

              {/* Search Bar */}
              <form
                action="/doctors"
                method="GET"
                className="mt-8 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 sm:flex-row sm:items-center"
                style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.06), 0 1px 3px rgba(37,99,235,0.04)' }}
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    name="search"
                    placeholder="Search doctor by name…"
                    className="w-full border-0 bg-transparent pl-11 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>

                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                <select
                  name="specialization"
                  defaultValue=""
                  aria-label="Select medical specialization"
                  className="border-0 bg-transparent px-3 py-3 text-sm text-slate-600 focus:outline-none sm:max-w-[200px]"
                >
                  <option value="">All Specialties</option>
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {SPECIALIZATION_LABELS[spec]}
                    </option>
                  ))}
                </select>

                <button type="submit" className="btn-primary shrink-0 px-6 py-3">
                  Find Doctor
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {/* Popular tags */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Popular:</span>
                {['cardiologist', 'dermatologist', 'pediatrician', 'general physician'].map((spec) => (
                  <Link
                    key={spec}
                    href={`/doctors?specialization=${encodeURIComponent(spec)}`}
                    className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 transition-all hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                  >
                    {SPECIALIZATION_LABELS[spec]}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right Column — Live Queue Preview */}
            <div className="lg:col-span-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
              <div className="relative mx-auto max-w-md">
                {/* Floating accent badge */}
                <div className="absolute -top-3 -right-3 z-20 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-lg flex items-center gap-1.5 animate-float" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)' }}>
                  <Activity className="h-4 w-4" />
                  Live Sync
                </div>

                {/* Card */}
                <div className="rounded-3xl border border-slate-200/60 p-6" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafb 100%)', boxShadow: '0 20px 50px rgba(15,23,42,0.08), 0 4px 12px rgba(37,99,235,0.04)' }}>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #0284c7 100%)' }}>
                        PS
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Dr. Priya Sharma</h4>
                        <p className="text-xs text-blue-600 font-medium">Cardiology Specialist</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Active
                    </span>
                  </div>

                  {/* Dark token panel */}
                  <div className="mt-5 rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0b192c 50%, #0f2444 100%)' }}>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      <span>Live Queue Display</span>
                      <span className="flex items-center gap-1 text-emerald-400 font-mono">
                        <Clock className="h-3 w-3" /> IST
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <span className="text-[9px] uppercase text-slate-400 block font-semibold tracking-wider">Current</span>
                        <span className="mt-1 text-2xl font-black font-mono text-amber-400">#14</span>
                      </div>
                      <div className="rounded-xl p-3 border border-blue-500/30" style={{ background: 'rgba(37,99,235,0.12)' }}>
                        <span className="text-[9px] uppercase text-blue-300 block font-semibold tracking-wider">You</span>
                        <span className="mt-1 text-2xl font-black font-mono text-blue-400">#16</span>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                        <span className="text-[9px] uppercase text-slate-400 block font-semibold tracking-wider">Wait</span>
                        <span className="mt-1 text-2xl font-black font-mono text-sky-300">8m</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300 border border-white/5">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                        1 ahead of you
                      </span>
                      <span className="font-semibold text-emerald-400">Arrive 11:15 AM</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Token assigned instantly on booking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span>Real-time updates via WebSocket</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-blue-300/30 to-transparent" />
      </section>

      {/* ═══════════════ TRUST COUNTERS ═══════════════ */}
      <section className="bg-white py-10">
        <div className="page-container">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { icon: ShieldCheck, value: '100%', label: 'Verified Doctors', color: 'text-blue-600 bg-blue-50' },
              { icon: Zap, value: '< 10s', label: 'Booking Speed', color: 'text-sky-600 bg-sky-50' },
              { icon: Users, value: 'Live', label: 'Socket.IO Sync', color: 'text-indigo-600 bg-indigo-50' },
              { icon: Heart, value: '99.4%', label: 'On-Time Rate', color: 'text-rose-500 bg-rose-50' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3.5 animate-fade-up">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xl font-extrabold text-slate-900">{item.value}</h4>
                  <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </section>

      {/* ═══════════════ SPECIALTIES ═══════════════ */}
      <section className="page-container py-16 sm:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Clinical Specializations
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Browse by department
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              From routine health checks to specialized cardiac care — connect with the right specialist.
            </p>
          </div>
          <Link
            href="/doctors"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 transition-colors"
          >
            All departments
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {SPECIALIZATIONS.map((spec, i) => (
            <Link
              key={spec}
              href={`/doctors?specialization=${encodeURIComponent(spec)}`}
              className={`card-hover group flex flex-col items-center justify-center p-5 text-center animate-fade-up stagger-${Math.min(i + 1, 6)}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/20 group-hover:scale-110">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800 capitalize group-hover:text-blue-700 transition-colors">
                {SPECIALIZATION_LABELS[spec]}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">Book now</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════ FEATURED DOCTORS ═══════════════ */}
      {featuredDoctors.length > 0 && (
        <section className="bg-white py-16 sm:py-20">
          <div className="h-px bg-gradient-to-r from-transparent via-blue-300/20 to-transparent" />
          <div className="page-container pt-16 sm:pt-20">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Featured Doctors
                </span>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Top-rated physicians
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Verified, experienced, and available for immediate booking.
                </p>
              </div>
              <Link href="/doctors" className="btn-secondary text-xs">
                View all doctors
              </Link>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featuredDoctors.map((doc, i) => (
                <article
                  key={doc.id}
                  className={`card-hover flex flex-col justify-between p-6 animate-fade-up stagger-${Math.min(i + 1, 4)}`}
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

                    <h3 className="mt-4 text-base font-bold text-slate-900 truncate">
                      {doc.fullName}
                    </h3>
                    <p className="text-xs font-medium text-blue-600 capitalize mt-0.5">
                      {SPECIALIZATION_LABELS[doc.specialization] || doc.specialization}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <span className="text-[9px] text-slate-400 block font-semibold uppercase tracking-wider">Experience</span>
                        <span className="font-bold text-slate-800">{doc.experience} yrs</span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <span className="text-[9px] text-slate-400 block font-semibold uppercase tracking-wider">Fee</span>
                        <span className="font-bold text-slate-900">{formatCurrency(doc.consultationFee)}</span>
                      </div>
                    </div>
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
          </div>
        </section>
      )}

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="page-container py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
            <Zap className="h-3.5 w-3.5" />
            Engineered For Speed
          </span>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            How Schedula works
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Three simple steps. Zero waiting room anxiety.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Find & Book',
              desc: 'Browse verified doctors, pick an open time slot, and your appointment is instantly confirmed.',
              icon: Search,
              gradient: 'from-blue-600 to-sky-600',
            },
            {
              step: '02',
              title: 'Get Your Token',
              desc: 'Receive your sequential token. The doctor\'s live dashboard updates via WebSocket immediately.',
              icon: Calendar,
              gradient: 'from-sky-600 to-indigo-600',
            },
            {
              step: '03',
              title: 'Arrive On Time',
              desc: 'Monitor real-time queue from anywhere. Walk in exactly when called — no more idle waiting.',
              icon: Clock,
              gradient: 'from-indigo-600 to-blue-600',
            },
          ].map((item, i) => (
            <div
              key={item.step}
              className={`card relative flex flex-col p-7 animate-fade-up stagger-${i + 1}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-4xl font-black text-slate-100">
                  {item.step}
                </span>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} text-white shadow-sm`}>
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA banner */}
        {!user && (
          <div className="mt-16 relative overflow-hidden rounded-3xl p-8 text-center text-white sm:p-12" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)' }}>
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.25),transparent_70%)]" />
            <div className="relative z-10">
              <h3 className="text-2xl font-extrabold sm:text-3xl">Ready for a better clinic experience?</h3>
              <p className="mt-3 text-sm text-slate-300 max-w-lg mx-auto">
                Join patients and doctors experiencing zero waiting room friction.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/signup" className="btn-primary px-7 py-3">
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/10 transition-all"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
