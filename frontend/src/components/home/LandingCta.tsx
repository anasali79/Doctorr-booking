'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  Stethoscope,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Share2,
} from 'lucide-react';

const integrations = [
  'Google Calendar',
  'Apple Health',
  'NHS Spine',
  'EMR Systems',
  'Twilio SMS',
  'WhatsApp Business',
  'Stripe Payments',
];

export function LandingCta() {
  return (
    <section className="py-20 lg:py-28 bg-[#fafcff]">
      <div className="page-container space-y-16">
        
        {/* Integration Compatibility Strip */}
        <div className="text-center space-y-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            CareUp connects to the healthcare systems and calendars you already use
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {integrations.map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#0066cc]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Grand Curved CTA Banner (Brevo Style with CareUp Clinical Sky-Blue Theme) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[2.5rem] lg:rounded-[3.5rem] bg-gradient-to-b from-[#e0f2fe] via-[#edf5fd] to-[#f4f8fc] border border-sky-200/90 p-8 sm:p-14 lg:p-20 text-center shadow-lg shadow-sky-950/5"
        >
          {/* Subtle ambient lighting */}
          <div className="absolute top-0 right-1/3 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-sky-200 px-3.5 py-1 text-xs font-semibold text-sky-800 shadow-2xs backdrop-blur-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Get started in under 2 minutes • No credit card required</span>
            </span>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Ready to modernize your clinic experience with CareUp?
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
              Join thousands of patients and certified general practitioners transforming waiting room chaos into real-time tranquility.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/doctors"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0066cc] px-8 py-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-[#0055b3] hover:shadow-lg hover:shadow-blue-600/30 active:scale-95"
              >
                <Calendar className="h-4 w-4 text-sky-200" />
                <span>Book an Appointment</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-300/90 bg-white px-7 py-4 text-sm font-bold text-slate-800 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-95"
              >
                <Stethoscope className="h-4 w-4 text-[#0066cc]" />
                <span>Register as Doctor</span>
              </Link>
            </div>

            {/* Mini Trust Line */}
            <div className="pt-2 flex items-center justify-center gap-6 text-xs text-slate-600 font-medium">
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

