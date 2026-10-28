'use client';

import React from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';

export function FeaturedDoctorCard() {
  return (
    <article className="group relative flex flex-col sm:flex-row items-center justify-between rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md overflow-hidden">
      {/* ── Left Side: Teal / Dark Cyan Schedule Card ── */}
      <div className="w-full sm:w-[58%] rounded-2xl bg-[#0f766e] p-5 text-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Dr. Adeyemi -
            </h3>
            <span className="inline-block rounded-full bg-[#134e4a] px-2.5 py-0.5 text-[10px] font-semibold text-teal-200 border border-teal-500/30">
              Psychiatrist
            </span>
          </div>

          <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Today, 09:30
          </p>
        </div>

        <div className="mt-4 space-y-1.5 text-xs text-teal-100 font-medium">
          <div className="flex items-center gap-2">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-300/30 text-teal-200 shrink-0">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </span>
            <span>Pay online or at the desk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-300/30 text-teal-200 shrink-0">
              <Check className="h-2.5 w-2.5 stroke-[3]" />
            </span>
            <span>Same day until 16:00</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-teal-600/40">
          <Link
            href="/doctors"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-teal-200 transition-colors"
          >
            <span>Book this slot</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* ── Right Side: Illustrated Doctor Portrait (Dr. Adeyemi) ── */}
      <div className="relative flex items-end justify-center w-full sm:w-[40%] h-44 sm:h-52 overflow-hidden">
        <svg viewBox="0 0 140 160" fill="none" className="h-full w-auto max-h-52 drop-shadow-md">
          {/* Lab Coat Shoulders */}
          <path d="M10 160 C10 115 30 100 70 100 C110 100 130 115 130 160 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          {/* Inner Purple Shirt & Blue Tie */}
          <path d="M50 100 L70 125 L90 100 Z" fill="#7C3AED" />
          <path d="M66 104 L74 104 L72 135 L68 135 Z" fill="#1D4ED8" />
          {/* Stethoscope */}
          <path d="M42 104 C42 130 58 138 67 138" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          <path d="M98 104 C98 130 82 138 73 138" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          <circle cx="70" cy="140" r="5" fill="#94A3B8" stroke="#1E293B" strokeWidth="2" />
          {/* Neck */}
          <rect x="58" y="78" width="24" height="26" fill="#8D5B4C" rx="3" />
          {/* Head & Ears */}
          <ellipse cx="70" cy="62" rx="27" ry="30" fill="#8D5B4C" />
          <circle cx="43" cy="64" r="6" fill="#8D5B4C" />
          <circle cx="97" cy="64" r="6" fill="#8D5B4C" />
          {/* Eyes */}
          <ellipse cx="60" cy="59" rx="3" ry="3.5" fill="#111827" />
          <ellipse cx="80" cy="59" rx="3" ry="3.5" fill="#111827" />
          <circle cx="61.2" cy="58" r="1" fill="#FFFFFF" />
          <circle cx="81.2" cy="58" r="1" fill="#FFFFFF" />
          {/* Nose & Smile */}
          <path d="M70 60 L67 68 L73 68" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M64 74 C67 77 73 77 76 74" stroke="#451A03" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Hair & Trimmed Beard */}
          <path d="M43 50 C41 30 52 24 70 24 C88 24 99 30 97 50 C92 37 84 34 70 34 C56 34 48 37 43 50 Z" fill="#1C1917" />
          <path d="M55 74 C55 88 62 92 70 92 C78 92 85 88 85 74 C82 80 75 82 70 82 C65 82 58 80 55 74 Z" fill="#1C1917" />
        </svg>
      </div>
    </article>
  );
}
