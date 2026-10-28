'use client';

import React from 'react';
import { Check } from 'lucide-react';

export function HeroNetworkGraphic() {
  return (
    <div className="relative mx-auto flex w-full max-w-[460px] sm:max-w-[500px] h-[380px] sm:h-[420px] items-center justify-center select-none">
      {/* ── Background SVG Connection Network Lines ── */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox="0 0 500 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Connection lines from center hub (cx=250, cy=130) to satellite nodes */}
        {/* To Top-Left (x=70, y=110) */}
        <line x1="200" y1="125" x2="95" y2="110" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.6" />
        <circle cx="95" cy="110" r="3" fill="#0284c7" />

        {/* To Mid-Left (x=60, y=190) */}
        <line x1="195" y1="140" x2="85" y2="185" stroke="#94a3b8" strokeWidth="2" strokeOpacity="0.5" />
        <circle cx="85" cy="185" r="3" fill="#10b981" />

        {/* To Bottom-Left (x=75, y=275) */}
        <line x1="210" y1="170" x2="100" y2="270" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" strokeOpacity="0.6" />
        <circle cx="100" cy="270" r="3" fill="#ef4444" />

        {/* To Bottom-Left-Center (x=175, y=345) */}
        <line x1="235" y1="180" x2="185" y2="325" stroke="#94a3b8" strokeWidth="2" strokeOpacity="0.5" />
        <circle cx="185" cy="325" r="3" fill="#f59e0b" />

        {/* To Bottom-Right-Center (x=260, y=335) */}
        <line x1="255" y1="180" x2="260" y2="315" stroke="#94a3b8" strokeWidth="2" strokeOpacity="0.5" />
        <circle cx="260" cy="315" r="3" fill="#6366f1" />

        {/* To Bottom-Right (x=345, y=340) */}
        <line x1="285" y1="175" x2="345" y2="320" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.6" />
        <circle cx="345" cy="320" r="3" fill="#991b1b" />

        {/* To Mid-Right (x=380, y=275) */}
        <line x1="295" y1="155" x2="380" y2="265" stroke="#94a3b8" strokeWidth="2" strokeOpacity="0.5" />
        <circle cx="380" cy="265" r="3" fill="#8b5cf6" />

        {/* To Top-Right (x=360, y=110) */}
        <line x1="290" y1="125" x2="360" y2="115" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.6" />
        <circle cx="360" cy="115" r="3" fill="#14b8a6" />
      </svg>

      {/* ── Center Main Doctor Hub (Dr. Adeyemi in Dark Blue Rounded Box) ── */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        {/* Dark Blue Center Card with Doctor Avatar */}
        <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-2xl bg-[#1e40af] p-1.5 shadow-xl ring-4 ring-white transition-transform duration-300 hover:scale-105">
          <div className="h-full w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#1e40af] to-[#1e3a8a] flex items-end justify-center">
            {/* Detailed Doctor Portrait (Dr. Adeyemi) */}
            <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
              {/* Lab Coat */}
              <path d="M15 100 C15 76 28 68 50 68 C72 68 85 76 85 100 Z" fill="#FFFFFF" />
              {/* Shirt (Purple) & Tie (Blue) */}
              <path d="M38 68 L50 82 L62 68 Z" fill="#7C3AED" />
              <path d="M47 70 L53 70 L51 86 L49 86 Z" fill="#1D4ED8" />
              {/* Stethoscope */}
              <path d="M33 72 C33 88 43 92 48 92" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M67 72 C67 88 57 92 52 92" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="50" cy="92" r="3.5" fill="#94A3B8" stroke="#0F172A" strokeWidth="1.5" />
              {/* Neck & Face */}
              <rect x="43" y="55" width="14" height="15" fill="#8D5B4C" rx="2" />
              <ellipse cx="50" cy="46" rx="19" ry="21" fill="#8D5B4C" />
              {/* Ears */}
              <circle cx="31" cy="48" r="4.5" fill="#8D5B4C" />
              <circle cx="69" cy="48" r="4.5" fill="#8D5B4C" />
              {/* Eyes */}
              <ellipse cx="43" cy="44" rx="2" ry="2.5" fill="#111827" />
              <ellipse cx="57" cy="44" rx="2" ry="2.5" fill="#111827" />
              <circle cx="43.8" cy="43.5" r="0.7" fill="#FFFFFF" />
              <circle cx="57.8" cy="43.5" r="0.7" fill="#FFFFFF" />
              {/* Nose & Smile */}
              <path d="M50 45 L48 50 L52 50" stroke="#000" strokeOpacity="0.3" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path d="M46 54 C48 56 52 56 54 54" stroke="#451A03" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              {/* Hair & Beard */}
              <path d="M31 38 C30 24 38 20 50 20 C62 20 70 24 69 38 C66 28 60 26 50 26 C40 26 34 28 31 38 Z" fill="#1C1917" />
              <path d="M40 54 C40 64 45 66 50 66 C55 66 60 64 60 54 C58 58 53 59 50 59 C47 59 42 58 40 54 Z" fill="#1C1917" />
            </svg>
          </div>
        </div>

        {/* Floating "Next available" Status Badge */}
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-1.5 shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-semibold text-slate-400 leading-tight">Next available</span>
            <span className="text-[11px] font-bold text-slate-900 leading-tight">Dr Adeyemi · Today, 09:20</span>
          </div>
        </div>
      </div>

      {/* ── Satellite Avatar Nodes (Surrounding the Center) ── */}

      {/* 1. Top-Left Node (Cyan ring) */}
      <div className="absolute top-20 left-4 sm:left-6 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#e0f2fe] ring-4 ring-[#0284c7] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#F4B495" />
            <circle cx="30" cy="24" r="13" fill="#F4B495" />
            <path d="M17 22 C17 12 23 8 30 8 C37 8 43 12 43 22 Z" fill="#4B5563" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#0284C7" />
          </svg>
        </div>
      </div>

      {/* 2. Mid-Left Node (Emerald ring) */}
      <div className="absolute top-44 left-1 sm:left-3 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#d1fae5] ring-4 ring-[#059669] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#D97706" />
            <circle cx="30" cy="24" r="13" fill="#D97706" />
            <path d="M17 21 C17 11 23 7 30 7 C37 7 43 11 43 21 Z" fill="#1C1917" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#059669" />
          </svg>
        </div>
      </div>

      {/* 3. Bottom-Left Node (Rose/Coral ring) */}
      <div className="absolute bottom-16 left-6 sm:left-8 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#fee2e2] ring-4 ring-[#dc2626] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#FBCFE8" />
            <circle cx="30" cy="24" r="13" fill="#FBCFE8" />
            <path d="M18 25 C18 13 22 9 30 9 C38 9 42 13 42 25 Z" fill="#B45309" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#DC2626" />
          </svg>
        </div>
      </div>

      {/* 4. Bottom-Left-Center Node (Amber/Yellow ring) */}
      <div className="absolute bottom-4 left-24 sm:left-28 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#fef3c7] ring-4 ring-[#d97706] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#F4B495" />
            <circle cx="30" cy="24" r="13" fill="#F4B495" />
            <path d="M17 20 C17 10 23 6 30 6 C37 6 43 10 43 20 Z" fill="#78350F" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#D97706" />
          </svg>
        </div>
      </div>

      {/* 5. Bottom-Right-Center Node (Indigo ring) */}
      <div className="absolute bottom-4 right-28 sm:right-32 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#e0e7ff] ring-4 ring-[#4f46e5] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#F4B495" />
            <circle cx="30" cy="24" r="13" fill="#F4B495" />
            <path d="M17 22 C17 12 23 8 30 8 C37 8 43 12 43 22 Z" fill="#1E293B" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#4F46E5" />
          </svg>
        </div>
      </div>

      {/* 6. Bottom-Right Node (Crimson ring) */}
      <div className="absolute bottom-16 right-8 sm:right-10 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#ffe4e6] ring-4 ring-[#991b1b] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#F4B495" />
            <circle cx="30" cy="24" r="13" fill="#F4B495" />
            <path d="M17 21 C17 11 23 7 30 7 C37 7 43 11 43 21 Z" fill="#7F1D1D" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#991B1B" />
          </svg>
        </div>
      </div>

      {/* 7. Mid-Right Node (Purple ring) */}
      <div className="absolute top-44 right-2 sm:right-4 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#f3e8ff] ring-4 ring-[#7c3aed] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#F4B495" />
            <circle cx="30" cy="24" r="13" fill="#F4B495" />
            <path d="M17 22 C17 12 23 8 30 8 C37 8 43 12 43 22 Z" fill="#581C87" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#7C3AED" />
          </svg>
        </div>
      </div>

      {/* 8. Top-Right Node (Teal ring) */}
      <div className="absolute top-20 right-6 sm:right-8 z-10 transition-transform duration-200 hover:scale-110">
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#ccfbf1] ring-4 ring-[#0d9488] shadow-md overflow-hidden">
          <svg viewBox="0 0 60 60" fill="none" className="h-10 w-10 mt-1">
            <rect x="25" y="32" width="10" height="8" fill="#F4B495" />
            <circle cx="30" cy="24" r="13" fill="#F4B495" />
            <path d="M17 21 C17 11 23 7 30 7 C37 7 43 11 43 21 Z" fill="#134E4A" />
            <circle cx="26" cy="23" r="1.5" fill="#1E293B" />
            <circle cx="34" cy="23" r="1.5" fill="#1E293B" />
            <path d="M12 55 C12 42 20 37 30 37 C40 37 48 42 48 55 Z" fill="#0D9488" />
          </svg>
        </div>
      </div>
    </div>
  );
}
