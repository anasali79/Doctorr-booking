'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { SessionUser } from '@/types';

interface LandingHeroProps {
  user?: SessionUser | null;
}

export function LandingHero({ user }: LandingHeroProps) {
  return (
    <section className="py-6 sm:py-10 lg:py-12 bg-white">
      <div className="page-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[2.5rem] lg:rounded-[3.5rem] bg-gradient-to-b from-[#e0f2fe] via-[#edf5fd] to-[#f4f8fc] border border-sky-200/90 p-8 sm:p-14 lg:p-20 text-center shadow-lg shadow-sky-950/5"
        >
          {/* Subtle ambient lighting */}
          <div className="absolute top-0 right-1/3 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            
            {/* Clean Centered Badge Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-sky-200 px-3.5 py-1 text-xs font-semibold text-sky-800 shadow-2xs backdrop-blur-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Get started in under 2 minutes • No credit card required</span>
            </span>

            {/* Big Bold Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight text-slate-900 leading-[1.12]">
              Turn Every Clinic Visit into a{' '}
              <span className="relative whitespace-nowrap text-[#0066cc]">
                Seamless Journey.
                <svg
                  className="absolute left-0 -bottom-1.5 w-full h-3 text-sky-400/60"
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                  fill="none"
                >
                  <path
                    d="M0,9 Q50,0 100,9"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
              Say goodbye to 8 AM phone lines and crowded waiting rooms. CareUp coordinates
              real-time live queue tokens, transparent doctor schedules, and instant GP bookings
              so patients and practitioners stay in complete sync.
            </p>

            {/* Centered Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
              <Link
                href="/doctors"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-8 py-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-[#0055b3] hover:shadow-lg hover:shadow-blue-600/30 active:scale-95"
              >
                <Calendar className="h-4 w-4 text-sky-200" />
                <span>Book an Appointment</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href={
                  user
                    ? user.role === 'DOCTOR'
                      ? '/doctor/dashboard'
                      : '/patient/dashboard'
                    : '/login'
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-300/90 bg-white px-7 py-4 text-sm font-bold text-slate-800 shadow-2xs backdrop-blur-xs transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-95"
              >
                <Stethoscope className="h-4 w-4 text-[#0066cc]" />
                <span>{user ? 'Open Dashboard' : 'Register as Doctor'}</span>
              </Link>
            </div>

            {/* Centered Mini Trust Features */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-medium">
              <span>✓ Instant GP Booking</span>
              <span>✓ Live Queue Tracking</span>
              <span>✓ Free for Patients</span>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
