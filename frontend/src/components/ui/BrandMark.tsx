import React from 'react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  withGlow?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 rounded-xl',
  md: 'h-10 w-10 rounded-2xl',
  lg: 'h-12 w-12 rounded-2xl',
  xl: 'h-16 w-16 rounded-3xl',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

export function BrandMark({ size = 'md', className }: BrandMarkProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066cc] via-[#0055b3] to-[#00408a] text-white shadow-xs transition-all duration-200 hover:scale-105 hover:shadow-md ring-1 ring-white/20 overflow-hidden',
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      {/* Subtle top gloss highlight */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

      {/* Signature CareUp Symbol: Care Heart + Upward Vitality Arrow */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('relative z-10 text-white stroke-white drop-shadow-2xs', iconSizes[size])}
      >
        {/* Heart Left Wing (Care) */}
        <path
          d="M11.5 21C11.5 21 3 15.5 3 9.5C3 6.46 5.46 4 8.5 4C10.24 4 11.5 5 11.5 5"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Heart Right Lower Curve */}
        <path
          d="M20 12.5C19.5 15.5 16 18.5 11.5 21"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* ECG Vitality Pulse in Core */}
        <path
          d="M7 11.5H9.2L10.6 8L12.4 15L13.8 11.5H16.2"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Upward Rising Arrow Accent (Up) */}
        <path
          d="M15.5 4H20.5V9M20.5 4L14 10.5"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
