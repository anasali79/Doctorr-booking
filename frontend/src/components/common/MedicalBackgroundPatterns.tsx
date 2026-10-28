'use client';

import React from 'react';

export function MedicalBackgroundPatterns() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* ── Top-Left: Molecular Cluster / Chemical Bonds ── */}
      <svg
        className="absolute -top-6 -left-10 h-72 w-72 text-slate-300/40 sm:h-96 sm:w-96"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hexagonal molecular ring */}
        <polygon
          points="60,30 90,47 90,82 60,100 30,82 30,47"
          stroke="currentColor"
          strokeWidth="3.5"
          fill="none"
        />
        <line x1="90" y1="47" x2="130" y2="25" stroke="currentColor" strokeWidth="3" />
        <circle cx="130" cy="25" r="9" fill="#e2e8f0" stroke="currentColor" strokeWidth="3" />
        <line x1="90" y1="82" x2="130" y2="105" stroke="currentColor" strokeWidth="3" />
        <circle cx="130" cy="105" r="11" fill="#e2e8f0" stroke="currentColor" strokeWidth="3" />
        <line x1="130" y1="105" x2="160" y2="90" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 3" />
        <circle cx="160" cy="90" r="7" fill="#cbd5e1" stroke="currentColor" strokeWidth="2.5" />
        <line x1="60" y1="100" x2="60" y2="140" stroke="currentColor" strokeWidth="3" />
        <circle cx="60" cy="140" r="8" fill="#e2e8f0" stroke="currentColor" strokeWidth="3" />
        <line x1="30" y1="82" x2="5" y2="98" stroke="currentColor" strokeWidth="3" />
        <circle cx="5" cy="98" r="6" fill="#cbd5e1" stroke="currentColor" strokeWidth="2.5" />
        {/* Secondary small molecule */}
        <circle cx="60" cy="30" r="6" fill="#e2e8f0" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="30" cy="47" r="7" fill="#e2e8f0" stroke="currentColor" strokeWidth="2.5" />
      </svg>

      {/* ── Mid-Left & Lower-Left: DNA Double Helix Strand ── */}
      <svg
        className="absolute top-[38%] -left-12 h-[500px] w-64 text-slate-300/45 sm:w-72 lg:w-80"
        viewBox="0 0 160 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* DNA Strand 1 (Sine wave) */}
        <path
          d="M 40,0 Q 120,75 40,150 T 40,300 T 40,450 T 40,600"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        {/* DNA Strand 2 (Opposite Phase) */}
        <path
          d="M 100,0 Q 20,75 100,150 T 100,300 T 100,450 T 100,600"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        {/* Base-pair Rungs */}
        {[30, 60, 90, 120, 180, 210, 240, 270, 330, 360, 390, 420, 480, 510, 540, 570].map((y, i) => (
          <g key={i}>
            <line
              x1={40 + Math.sin((y / 75) * Math.PI) * 35}
              y1={y}
              x2={100 - Math.sin((y / 75) * Math.PI) * 35}
              y2={y}
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <circle
              cx={40 + Math.sin((y / 75) * Math.PI) * 35}
              cy={y}
              r="3.5"
              fill="#bfdbfe"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle
              cx={100 - Math.sin((y / 75) * Math.PI) * 35}
              cy={y}
              r="3.5"
              fill="#bfdbfe"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>

      {/* ── Top-Right: Molecular Network ── */}
      <svg
        className="absolute top-10 -right-12 h-64 w-64 text-slate-300/40 sm:h-80 sm:w-80"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="30" y1="60" x2="80" y2="40" stroke="currentColor" strokeWidth="3" />
        <circle cx="30" cy="60" r="10" fill="#e2e8f0" stroke="currentColor" strokeWidth="3" />
        <line x1="80" y1="40" x2="130" y2="60" stroke="currentColor" strokeWidth="3" />
        <circle cx="80" cy="40" r="12" fill="#e2e8f0" stroke="currentColor" strokeWidth="3" />
        <line x1="130" y1="60" x2="160" y2="110" stroke="currentColor" strokeWidth="3" />
        <circle cx="130" cy="60" r="9" fill="#e2e8f0" stroke="currentColor" strokeWidth="3" />
        <line x1="160" y1="110" x2="120" y2="140" stroke="currentColor" strokeWidth="3" />
        <circle cx="160" cy="110" r="11" fill="#e2e8f0" stroke="currentColor" strokeWidth="3" />
        <circle cx="120" cy="140" r="8" fill="#cbd5e1" stroke="currentColor" strokeWidth="2.5" />
      </svg>

      {/* ── Mid-Right & Lower-Right: DNA Double Helix Strand ── */}
      <svg
        className="absolute top-[22%] -right-14 h-[650px] w-72 text-slate-300/45 sm:w-80 lg:w-96"
        viewBox="0 0 160 650"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* DNA Strand 1 */}
        <path
          d="M 50,0 Q 130,80 50,160 T 50,320 T 50,480 T 50,640"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        {/* DNA Strand 2 */}
        <path
          d="M 110,0 Q 30,80 110,160 T 110,320 T 110,480 T 110,640"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        {/* Cross rungs */}
        {[30, 65, 100, 130, 190, 225, 260, 290, 350, 385, 420, 450, 510, 545, 580, 610].map((y, i) => (
          <g key={i}>
            <line
              x1={50 + Math.sin((y / 80) * Math.PI) * 36}
              y1={y}
              x2={110 - Math.sin((y / 80) * Math.PI) * 36}
              y2={y}
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <circle
              cx={50 + Math.sin((y / 80) * Math.PI) * 36}
              cy={y}
              r="3.5"
              fill="#bfdbfe"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle
              cx={110 - Math.sin((y / 80) * Math.PI) * 36}
              cy={y}
              r="3.5"
              fill="#bfdbfe"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
