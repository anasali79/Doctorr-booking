'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Timer,
  CheckCircle2,
  Stethoscope,
  HeartPulse,
  Brain,
  Baby,
  Bone,
} from 'lucide-react';

const tools = [
  {
    title: 'Smart Queue Velocity Estimator',
    subtitle: 'Autonomous Consultation Pace Engine',
    desc: 'Analyzes live doctor pacing, consultation complexity, and room turnarounds to provide realistic, dynamic wait estimations down to the minute.',
    tag: 'Dynamic Algorithm',
    badge: 'Real-time Math',
    features: [
      'Self-adjusting based on active consultation length',
      'Calculates delay buffer before alerting next patient',
      'Sends early warning if clinic is running ahead or behind',
    ],
    metric: '94% Prediction Accuracy',
  },
  {
    title: 'Specialist Triage & Department Matcher',
    subtitle: 'Guided Clinical Routing',
    desc: 'Helps patients immediately identify whether they need General Practice, Psychiatry, Pediatrics, Cardiology, or Orthopedic care before booking.',
    tag: 'Triage Engine',
    badge: 'Clinical Routing',
    features: [
      'Matches common symptoms with certified doctors',
      'Prevents incorrect bookings and referral delays',
      'Supports GP secondary review notes',
    ],
    metric: '100% Specialist Alignment',
  },
];

export function LandingSmartTools() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % tools.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + tools.length) % tools.length);
  };

  return (
    <section className="py-20 lg:py-28 bg-[#f8fbff] border-b border-slate-100">
      <div className="page-container">
        <div className="grid gap-12 lg:grid-cols-12 items-center">
          
          {/* Left Column: Heading, Subtitle & Arrow Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-[#0066cc]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Intelligent Clinic Operations</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Intelligent healthcare tools that work with you, and for you.
            </h2>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              CareUp’s smart algorithms quietly handle queue pacing, calculate true wait durations, and route patients to the right medical experts without adding clerical workload.
            </p>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={prevSlide}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-2xs transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-95"
                aria-label="Previous tool"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextSlide}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-slate-900 text-white shadow-2xs transition-all hover:bg-slate-800 active:scale-95"
                aria-label="Next tool"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="text-xs font-semibold text-slate-600 ml-2">
                {currentIndex + 1} of {tools.length}
              </span>
            </div>
          </div>

          {/* Right Column: Sliding Feature Cards */}
          <div className="lg:col-span-7">
            <div className="grid gap-6 sm:grid-cols-2">
              {tools.map((t, idx) => {
                const isFocused = idx === currentIndex;
                return (
                  <motion.div
                    key={idx}
                    animate={{
                      scale: isFocused ? 1.02 : 0.98,
                      opacity: isFocused ? 1 : 0.8,
                    }}
                    transition={{ duration: 0.3 }}
                    className={`rounded-3xl border p-7 transition-all duration-200 flex flex-col justify-between ${
                      isFocused
                        ? 'bg-white border-[#0066cc]/40 shadow-xl shadow-sky-950/5 ring-1 ring-[#0066cc]/20'
                        : 'bg-white/80 border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
                          {t.tag}
                        </span>
                        <span className="text-[11px] font-semibold bg-sky-50 text-[#0066cc] border border-sky-100 px-2.5 py-0.5 rounded-full">
                          {t.badge}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {t.title}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {t.subtitle}
                        </p>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {t.desc}
                      </p>

                      <ul className="space-y-2 pt-2 border-t border-slate-100">
                        {t.features.map((feat, fIdx) => (
                          <li
                            key={fIdx}
                            className="flex items-start gap-2 text-xs text-slate-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {t.metric}
                      </span>
                      <button
                        onClick={() => setCurrentIndex(idx)}
                        className="text-xs font-semibold text-[#0066cc] inline-flex items-center gap-1 hover:underline"
                      >
                        <span>Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

