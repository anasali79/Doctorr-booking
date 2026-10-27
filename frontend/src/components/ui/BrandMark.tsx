import React from 'react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  withGlow?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
  xl: 'h-16 w-16 rounded-3xl',
};

const iconSizes = {
  sm: 'h-4.5 w-4.5',
  md: 'h-5.5 w-5.5',
  lg: 'h-6.5 w-6.5',
  xl: 'h-9 w-9',
};

export function BrandMark({ size = 'md', className, withGlow = true }: BrandMarkProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-500 text-white shadow-sm transition-transform duration-300 hover:scale-105',
        sizeClasses[size],
        withGlow && 'shadow-blue-500/20 shadow-md',
        className,
      )}
      aria-hidden="true"
    >
      {/* Subtle inner highlight */}
      <div className="absolute inset-x-0 top-0 h-[40%] rounded-t-[inherit] bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

      {/* Modern Medical Pulse + Caduceus Cross SVG */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(iconSizes[size], 'drop-shadow-sm')}
      >
        {/* Shield / Node shape */}
        <path d="M12 2L4 5v6.5C4 16.5 7.4 21.2 12 22c4.6-.8 8-5.5 8-10.5V5l-8-3z" fill="currentColor" fillOpacity="0.15" />
        {/* Pulse waveform inside shield */}
        <path d="M7.5 12h2l1.5-3 2 6 1.5-3h2" />
      </svg>
    </div>
  );
}
