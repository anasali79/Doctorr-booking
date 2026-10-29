'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, ShieldCheck, HeartPulse, Hospital, Award, Stethoscope } from 'lucide-react';

const partners = [
  { name: 'Westbrook Medical Centre', icon: Hospital, location: 'Edinburgh' },
  { name: 'NHS Scotland Practices', icon: ShieldCheck, location: 'UK Health' },
  { name: 'Apollo Clinic Network', icon: HeartPulse, location: 'Multi-City' },
  { name: 'Mayfield Healthcare', icon: Building2, location: 'London' },
  { name: 'St. Jude Specialist Clinic', icon: Stethoscope, location: 'Consultation Suite' },
  { name: 'Edinburgh BioQuarter', icon: Award, location: 'Research Partner' },
];

export function LandingLogoMarquee() {
  return (
    <section className="py-12 border-b border-slate-100 bg-white">
      <div className="page-container">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-600 mb-8">
          Trusted by healthcare professionals, NHS GP surgeries & modern clinics
        </p>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6 items-center justify-items-center opacity-85">
          {partners.map((p, idx) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="flex flex-col items-center gap-1.5 text-center group transition-transform hover:scale-105"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-sky-50 group-hover:text-[#0066cc] transition-colors border border-slate-200/60">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 leading-tight">
                  {p.name}
                </span>
                <span className="text-[10px] text-slate-600">
                  {p.location}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

