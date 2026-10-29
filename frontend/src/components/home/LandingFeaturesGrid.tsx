'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  Smartphone,
  Tv,
  MessageSquare,
  Zap,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';

const channels = [
  {
    icon: Stethoscope,
    title: 'Doctor Console',
    desc: 'Live consultation controller, token caller, and patient history at doctor fingertips.',
    tag: 'Practitioner',
    badge: '1-Tap Actions',
  },
  {
    icon: Smartphone,
    title: 'Patient Web App',
    desc: 'Zero-install browser app for booking in under 60 seconds with live token tracking.',
    tag: 'Patients',
    badge: 'Instant Access',
  },
  {
    icon: Tv,
    title: 'Waiting Room TV Kiosk',
    desc: 'Full-screen waiting room display showing currently serving token and next 3 in queue.',
    tag: 'Clinic Hardware',
    badge: 'Live Broadcast',
  },
  {
    icon: MessageSquare,
    title: 'Instant SMS & Alerts',
    desc: 'Automated SMS nudges sent 24h before visit and when patient is 2 tokens away.',
    tag: 'Notifications',
    badge: '99.4% Delivery',
  },
  {
    icon: Zap,
    title: 'Walk-In Desk Sync',
    desc: 'Reception desk injects walk-ins or urgent triage cases into the live queue sequentially.',
    tag: 'Reception',
    badge: 'Zero Conflict',
  },
  {
    icon: BarChart3,
    title: 'Clinic Analytics',
    desc: 'Track average consultation duration, peak wait times, and clinic throughput metrics.',
    tag: 'Operations',
    badge: 'Real-time Stats',
  },
];

export function LandingFeaturesGrid() {
  return (
    <section className="py-20 lg:py-28 bg-white border-b border-slate-100">
      <div className="page-container">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
            OMNICHANNEL HEALTHCARE ORCHESTRATION
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Care at your fingertips, across every touchpoint.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            Whether inside the clinic cabin, waiting in the parking lot, or managing from the reception desk — CareUp connects everyone seamlessly.
          </p>
        </div>

        {/* 6 Grid Cards (Brevo Style) */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c, idx) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                whileHover={{ y: -5 }}
                className="group relative rounded-3xl border border-slate-200/90 bg-[#fafcff] p-7 transition-all duration-200 hover:bg-white hover:border-slate-300 hover:shadow-xl hover:shadow-sky-950/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#0066cc] border border-slate-200/80 shadow-2xs group-hover:bg-[#0066cc] group-hover:text-white transition-colors duration-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-full border border-slate-200/60">
                    {c.badge}
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                    {c.tag}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#0066cc] transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {c.desc}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-[#0066cc] transition-colors">
                  <span>Explore touchpoint</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

