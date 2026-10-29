'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  User,
  Stethoscope,
  Building2,
  CheckCircle2,
  ArrowRight,
  Clock,
  CalendarCheck,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface RoleData {
  id: string;
  name: string;
  icon: any;
  tagline: string;
  description: string;
  points: string[];
  ctaLabel: string;
  ctaHref: string;
  statNumber: string;
  statLabel: string;
}

const roles: RoleData[] = [
  {
    id: 'patients',
    name: 'For Patients',
    icon: User,
    tagline: 'Skip the waiting room. Arrive right when your token is called.',
    description:
      'Book verified general practitioners and specialists in less than 60 seconds. Track your token live from home or your car with zero anxiety.',
    points: [
      'Real-time token position and accurate wait countdown',
      'Instant booking with verified doctor profiles and specialties',
      'One-click rescheduling and automated SMS alerts',
      'No registration fees or hidden appointment booking charges',
    ],
    ctaLabel: 'Find a Doctor Near You',
    ctaHref: '/doctors',
    statNumber: '< 60 sec',
    statLabel: 'Average booking time',
  },
  {
    id: 'doctors',
    name: 'For Doctors',
    icon: Stethoscope,
    tagline: 'Take full command of your daily consultations and clinic pacing.',
    description:
      'Streamline patient check-ins, manage walk-in tokens, set flexible consultation slots, and trigger instant consultation start/complete actions.',
    points: [
      'Interactive "My Day" dashboard with live queue call buttons',
      'Flexible slot rules: 10, 15, or 30-minute consultation intervals',
      'One-click emergency leave and automated patient rescheduling',
      'Real-time WebSocket sync across all clinic reception screens',
    ],
    ctaLabel: 'Join as a Practitioner',
    ctaHref: '/signup',
    statNumber: '+35%',
    statLabel: 'Daily clinic throughput',
  },
  {
    id: 'clinics',
    name: 'For Clinics & Practices',
    icon: Building2,
    tagline: 'Eliminate reception congestion and morning 8 AM telephone panic.',
    description:
      'Empower receptionists and clinic managers with unified walk-in injection, waiting room TV kiosk displays, and practice attendance analytics.',
    points: [
      'Full-screen Waiting Room TV display with audio token calling',
      'Instant walk-in and emergency token insertion without collisions',
      'Zero no-show rate powered by automated SMS & WhatsApp reminders',
      'Comprehensive doctor performance and patient satisfaction metrics',
    ],
    ctaLabel: 'Schedule Practice Demo',
    ctaHref: '/signup',
    statNumber: '99.4%',
    statLabel: 'On-time attendance rate',
  },
];

export function LandingRoleTabs() {
  const [activeTab, setActiveTab] = useState<string>('patients');
  const role = roles.find((r) => r.id === activeTab) || roles[0];

  return (
    <section className="py-20 lg:py-28 bg-white border-b border-slate-100">
      <div className="page-container">
        
        {/* Section Title */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
            TAILORED FOR THE ENTIRE CARE JOURNEY
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Built for everyone in healthcare — from patients to multi-doctor practices.
          </h2>
        </div>

        {/* Pill Tabs (Brevo Style) */}
        <div className="flex justify-center mb-14">
          <div className="inline-flex rounded-full bg-slate-100 p-1.5 border border-slate-200/80">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = activeTab === r.id;
              return (
                <Button key={r.id} type="button" variant="ghost" onClick={() => setActiveTab(r.id)} className={`relative flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  } h-auto`}>
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-[#0066cc]' : 'text-slate-400'}`} />
                  <span>{r.name}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Box */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl border border-slate-200/90 bg-[#fafcff] p-8 sm:p-12 shadow-lg shadow-sky-950/5"
          >
            <div className="grid gap-10 lg:grid-cols-12 items-center">
              
              {/* Left Column: Details & Checklist */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
                    {role.name}
                  </span>
                  <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {role.tagline}
                  </h3>
                  <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                    {role.description}
                  </p>
                </div>

                {/* Feature Checklist */}
                <ul className="grid gap-3 sm:grid-cols-2 pt-2">
                  {role.points.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4">
                  <Link
                    href={role.ctaHref}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0066cc] px-6 py-3.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-[#0055b3] hover:shadow-lg hover:shadow-blue-600/30 active:scale-95"
                  >
                    <span>{role.ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Highlight Card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border border-white bg-white p-6 shadow-md shadow-sky-950/5 space-y-6">
                  <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50/50 p-6 text-center border border-sky-100">
                    <span className="text-xs uppercase font-bold text-sky-700 tracking-wider">
                      {role.statLabel}
                    </span>
                    <p className="mt-2 text-4xl sm:text-5xl font-black text-[#0066cc]">
                      {role.statNumber}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Verified across CareUp practices
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-100 pb-2.5">
                      <span className="font-medium">Compatibility</span>
                      <span className="font-bold text-slate-800">Desktop, Tablet, iOS & Android</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-100 pb-2.5">
                      <span className="font-medium">Data Encryption</span>
                      <span className="font-bold text-emerald-600">256-bit End-to-End</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-medium">Live Queue Sync</span>
                      <span className="font-bold text-slate-800">&lt; 150ms Latency</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}

