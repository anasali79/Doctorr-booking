'use client';

import React from 'react';

interface DoctorAvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  className?: string;
  index?: number;
}

const PALETTES = [
  { bg: '#FFE6C7', skin: '#7A4A2E', hair: '#1C130F', shirt: '#2563EB', hairStyle: 'curly' },
  { bg: '#DCEBFF', skin: '#F1C6A4', hair: '#B4572A', shirt: '#16A34A', hairStyle: 'short', glasses: true },
  { bg: '#E3F6DA', skin: '#EBC09A', hair: '#17171A', shirt: '#DB2777', hairStyle: 'bob' },
  { bg: '#EFE3FF', skin: '#A97450', hair: '#29201B', shirt: '#0F766E', hairStyle: 'short', beard: true },
  { bg: '#FFE2E2', skin: '#F4CFB3', hair: '#8A3A1C', shirt: '#7C3AED', hairStyle: 'long' },
  { bg: '#E0F2FE', skin: '#EBC09A', hair: '#1C130F', shirt: '#2563EB', hairStyle: 'long' },
];

const sizeMap = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-24 h-24',
  hero: 'w-28 h-28 sm:w-32 sm:h-32',
};

export function DoctorAvatar({ name = 'Doctor', size = 'md', className = '', index = 0 }: DoctorAvatarProps) {
  // Deterministic palette based on name or index
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  }
  const paletteIndex = Math.abs((hash + (index || 0)) % PALETTES.length);
  const p = PALETTES[paletteIndex];

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl shadow-sm ${sizeMap[size]} ${className}`}
      style={{ backgroundColor: p.bg }}
      aria-label={name}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Lab Coat / Shoulders */}
        <path
          d="M15 98 C15 76 28 68 50 68 C72 68 85 76 85 98 Z"
          fill="#FFFFFF"
          stroke="#E2E8F0"
          strokeWidth="1.5"
        />

        {/* Inner Scrubs / Shirt */}
        <path
          d="M38 70 L50 84 L62 70 C58 72 42 72 38 70 Z"
          fill={p.shirt}
        />

        {/* Stethoscope tubing */}
        <path
          d="M33 72 C33 88 43 92 48 92"
          stroke="#0F172A"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M67 72 C67 88 57 92 52 92"
          stroke="#0F172A"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Stethoscope bell */}
        <circle cx="50" cy="93" r="3.5" fill="#94A3B8" stroke="#0F172A" strokeWidth="1.5" />

        {/* Neck */}
        <rect x="43" y="55" width="14" height="15" rx="3" fill={p.skin} />

        {/* Face */}
        <ellipse cx="50" cy="46" rx="20" ry="22" fill={p.skin} />

        {/* Ears */}
        <circle cx="30" cy="48" r="4.5" fill={p.skin} />
        <circle cx="70" cy="48" r="4.5" fill={p.skin} />

        {/* Eyes */}
        <ellipse cx="43" cy="45" rx="2.2" ry="2.6" fill="#1E293B" />
        <ellipse cx="57" cy="45" rx="2.2" ry="2.6" fill="#1E293B" />
        <circle cx="43.8" cy="44.2" r="0.8" fill="#FFFFFF" />
        <circle cx="57.8" cy="44.2" r="0.8" fill="#FFFFFF" />

        {/* Eyebrows */}
        <path d="M39 40 C41 38 45 38 47 40" stroke={p.hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M53 40 C55 38 59 38 61 40" stroke={p.hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />

        {/* Nose */}
        <path d="M50 45 L49 50 L52 50" stroke="#000000" strokeOpacity="0.25" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Smile */}
        <path d="M45 54 C48 57 52 57 55 54" stroke="#78350F" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" fill="none" />

        {/* Hair Styles */}
        {p.hairStyle === 'curly' && (
          <g fill={p.hair}>
            <circle cx="34" cy="27" r="9" />
            <circle cx="45" cy="23" r="10" />
            <circle cx="56" cy="23" r="10" />
            <circle cx="66" cy="27" r="9" />
            <circle cx="28" cy="36" r="7" />
            <circle cx="72" cy="36" r="7" />
          </g>
        )}

        {p.hairStyle === 'bob' && (
          <path
            d="M28 44 C27 26 36 21 50 21 C64 21 73 26 72 44 C72 50 69 52 69 46 C69 33 65 27 50 27 C35 27 31 33 31 46 C31 52 28 50 28 44 Z"
            fill={p.hair}
          />
        )}

        {p.hairStyle === 'short' && (
          <path
            d="M30 40 C28 26 38 22 50 22 C62 22 72 26 70 40 C67 29 61 27 50 27 C39 27 33 29 30 40 Z"
            fill={p.hair}
          />
        )}

        {p.hairStyle === 'long' && (
          <path
            d="M29 46 C27 25 36 21 50 21 C64 21 73 25 71 46 C71 58 68 64 68 56 C68 32 64 27 50 27 C36 27 32 32 32 56 C32 64 29 58 29 46 Z"
            fill={p.hair}
          />
        )}

        {/* Glasses */}
        {p.glasses && (
          <g stroke="#0F172A" strokeWidth="1.5" fill="none">
            <rect x="37" y="41" width="11" height="8" rx="2.5" fill="#FFFFFF" fillOpacity="0.2" />
            <rect x="52" y="41" width="11" height="8" rx="2.5" fill="#FFFFFF" fillOpacity="0.2" />
            <path d="M48 44 L52 44" />
            <path d="M37 44 L32 43" />
            <path d="M63 44 L68 43" />
          </g>
        )}

        {/* Beard */}
        {p.beard && (
          <path
            d="M40 54 C40 64 45 66 50 66 C55 66 60 64 60 54 C58 58 53 59 50 59 C47 59 42 58 40 54 Z"
            fill="#29201B"
          />
        )}
      </svg>
    </div>
  );
}
