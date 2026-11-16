'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { CollapsingCards } from '@/components/ui/cue-collapsing-cards-accordion';

export function LandingSmartTools() {
  return (
    <section className="py-20 lg:py-28 overflow-hidden bg-white">
      <div className="page-container space-y-12 sm:space-y-14">

        {/* Section Header: Centered with Badges */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight"
          >
            Intelligent healthcare tools that work with you, and for you.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="text-slate-600 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl mx-auto font-normal"
          >
            CareUp’s smart algorithms quietly handle queue pacing, calculate true wait durations, and route patients to the right medical experts without adding clerical workload.
          </motion.p>
        </div>

        {/* 3-Card Collapsing Cards Accordion */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <CollapsingCards height="540px" defaultActive={1} />
        </motion.div>

      </div>
    </section>
  );
}
