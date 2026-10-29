'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Award, HeartPulse, CheckCircle2, ShieldAlert } from 'lucide-react';

const badges = [
  {
    icon: ShieldCheck,
    title: 'HIPAA Compliant',
    desc: 'Medical Privacy Protected',
    color: 'text-blue-600 bg-blue-100/70 border-blue-200',
  },
  {
    icon: Lock,
    title: 'ISO 27001 Certified',
    desc: 'Information Security',
    color: 'text-emerald-600 bg-emerald-100/70 border-emerald-200',
  },
  {
    icon: Award,
    title: 'NHS Digital Ready',
    desc: 'Clinical Compliance',
    color: 'text-amber-600 bg-amber-100/70 border-amber-200',
  },
  {
    icon: HeartPulse,
    title: '99.99% Uptime',
    desc: 'High-Availability Cloud',
    color: 'text-sky-600 bg-sky-100/70 border-sky-200',
  },
  {
    icon: CheckCircle2,
    title: '256-Bit SSL',
    desc: 'Bank-Grade Encryption',
    color: 'text-indigo-600 bg-indigo-100/70 border-indigo-200',
  },
];

export function LandingTrustBadges() {
  return (
    <section className="py-16 bg-[#fbf9f5] border-b border-slate-100">
      <div className="page-container">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            SECURITY & RECOGNITION
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Certified for healthcare safety & trust.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Your patient records, doctor consultations, and token metrics are protected under strict international healthcare standards.
          </p>
        </div>

        {/* 5 Badges in a Row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 items-stretch">
          {badges.map((b, idx) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-2xs flex flex-col items-center justify-center space-y-2 hover:shadow-sm transition-shadow"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${b.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  {b.title}
                </h3>
                <p className="text-[11px] text-slate-600 font-medium">
                  {b.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

