'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Activity,
  CalendarCheck,
  BellRing,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface FeatureItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  badge: string;
  nodes: { label: string; role: string; active?: boolean }[];
  graphicTitle: string;
  graphicDetail: string;
}

const features: FeatureItem[] = [
  {
    id: 'queue',
    tag: 'REAL-TIME QUEUE DISPATCH',
    title: 'Zero-Wait Live Queue Engine',
    description:
      'Patients track their live token from their smartphone or waiting lounge. Our low-latency WebSocket connection notifies them the exact moment to walk into the consulting cabin.',
    badge: 'Real-time WebSocket Sync',
    nodes: [
      { label: 'Patient Phone', role: 'Token #06 (Arrived)', active: true },
      { label: 'Doctor Cabin', role: 'Serving #04', active: true },
      { label: 'Reception TV', role: 'Displaying Live Queue', active: false },
      { label: 'Pharmacy Desk', role: 'Rx Pre-notified', active: false },
    ],
    graphicTitle: 'Live Queue Orchestration',
    graphicDetail: '100% synchronized tokens across patient, doctor, and clinic screens.',
  },
  {
    id: 'scheduling',
    tag: 'INTELLIGENT CALENDAR',
    title: 'Doctor Shift & Leave Control',
    description:
      'Doctors define their consultation availability, slot durations (10/15/30 mins), and sudden emergency leaves. Affected appointments get automatically rescheduled without receptionist chaos.',
    badge: '1-Click Shift Management',
    nodes: [
      { label: 'Doctor Availability', role: 'Mon-Fri 09:00 - 17:00', active: true },
      { label: 'Automatic Slots', role: '15-min intervals', active: true },
      { label: 'Emergency Leave', role: 'Instant Reallocation', active: false },
      { label: 'Patient Calendar', role: 'Instant .ics Sync', active: true },
    ],
    graphicTitle: 'Autonomous Schedule Engine',
    graphicDetail: 'Eliminates double bookings and receptionist telephone fatigue.',
  },
  {
    id: 'automation',
    tag: 'PREDICTIVE CARE',
    title: 'Automated Reminders & Triage',
    description:
      'Smart automated notifications keep attendance at 99.4%. Patients receive SMS & email nudges 24 hours and 2 tokens before their scheduled consultation.',
    badge: '99.4% Attendance Rate',
    nodes: [
      { label: 'SMS Notification', role: 'Sent 2 tokens ahead', active: true },
      { label: 'Token Verification', role: 'QR Check-in', active: true },
      { label: 'No-Show Recovery', role: 'Auto-advance Next Patient', active: true },
      { label: 'Feedback Rating', role: 'Post-consult survey', active: false },
    ],
    graphicTitle: 'Smart Communication Mesh',
    graphicDetail: 'Instant SMS & email routing ensures zero vacant slots.',
  },
];

export function LandingShowcase() {
  const [activeTab, setActiveTab] = useState<string>('queue');
  const current = features.find((f) => f.id === activeTab) || features[0];

  return (
    <section className="py-20 lg:py-28 bg-[#fafcff] border-b border-slate-100">
      <div className="page-container">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0066cc]">
            ENGINEERED FOR MODERN HEALTHCARE
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Smart clinic flows that work with you, not against you.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            CareUp bridges the gap between patient expectations and clinical precision with an interconnected medical workflow.
          </p>
        </div>

        {/* 2-Column Split: Interactive Diagram (Left) & Feature Cards (Right) */}
        <div className="grid gap-12 lg:grid-cols-12 items-center">
          
          {/* Left Column: Interactive Connected Network Graphic */}
          <div className="lg:col-span-6">
            <div className="relative rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-sky-950/5 overflow-hidden">
              {/* Background grid */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(#0066cc 1px, transparent 1px)`,
                  backgroundSize: '20px 20px',
                }}
              />

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      {current.graphicTitle}
                    </span>
                  </div>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#0066cc] border border-sky-100">
                    {current.badge}
                  </span>
                </div>

                {/* Central Pulse Hub Diagram */}
                <div className="relative my-6 py-6 flex flex-col items-center justify-center">
                  
                  {/* Central Hub */}
                  <motion.div
                    key={activeTab}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#0066cc] to-sky-500 text-white flex flex-col items-center justify-center shadow-lg shadow-blue-500/20 relative z-20"
                  >
                    <Activity className="h-8 w-8 text-white animate-pulse" />
                    <span className="text-[10px] font-bold mt-0.5">CareUp Core</span>
                  </motion.div>

                  {/* Connected Satellite Nodes (2x2 Grid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full mt-8">
                    {current.nodes.map((node, i) => (
                      <motion.div
                        key={`${activeTab}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.08 }}
                        className={`rounded-2xl p-3.5 border transition-all ${
                          node.active
                            ? 'bg-sky-50/70 border-sky-200 shadow-xs'
                            : 'bg-slate-50/80 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{node.label}</span>
                          {node.active && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 font-medium">
                          {node.role}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-600 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{current.graphicDetail}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3 Clickable Feature Cards */}
          <div className="lg:col-span-6 space-y-4">
            {features.map((f) => {
              const isActive = activeTab === f.id;
              return (
                <motion.div
                  key={f.id}
                  onClick={() => setActiveTab(f.id)}
                  whileHover={{ x: 4 }}
                  className={`cursor-pointer rounded-3xl p-6 sm:p-7 border transition-all duration-200 ${
                    isActive
                      ? 'bg-white border-[#0066cc]/40 shadow-lg shadow-sky-950/5 ring-1 ring-[#0066cc]/20'
                      : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold tracking-wider uppercase ${
                        isActive ? 'text-[#0066cc]' : 'text-slate-400'
                      }`}
                    >
                      {f.tag}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-sky-100/70 text-[#0066cc]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg sm:text-xl font-bold text-slate-900">
                    {f.title}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {f.description}
                  </p>

                  <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#0066cc]">
                    <span>Learn how it works</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}

