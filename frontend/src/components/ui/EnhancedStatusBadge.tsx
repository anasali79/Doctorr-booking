'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AppointmentStatus } from '@/types';
import { STATUS_CONFIG } from '@/lib/constants';

interface EnhancedStatusBadgeProps {
  status: AppointmentStatus;
  variant?: 'default' | 'outline' | 'subtle' | 'timeline' | 'dot-only' | 'pill';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  animated?: boolean;
  showIcon?: boolean;
  className?: string;
  onClick?: () => void;
}

// Icon mappings for each status
const statusIcons: Record<AppointmentStatus, React.ReactNode> = {
  CONFIRMED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  CHECKED_IN: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  IN_CONSULTATION: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  COMPLETED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  CANCELLED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  NO_SHOW: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  RESCHEDULED: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
};

const sizeMap = {
  xs: 'px-1.5 py-0.5 gap-1 text-[10px]',
  sm: 'px-2 py-0.5 gap-1 text-xs',
  md: 'px-2.5 py-1 gap-1.5 text-xs',
  lg: 'px-3 py-1.5 gap-2 text-sm'
};

const variantStyles = {
  default: (config: any) => cn(
    config.bg,
    config.text,
    config.border,
    'shadow-xs'
  ),
  outline: (config: any) => cn(
    'bg-white border-2',
    config.text,
    config.border,
    'shadow-sm hover:shadow-md'
  ),
  subtle: (config: any) => cn(
    config.bg.replace('50', '50/80').replace('100', '100/80'),
    config.text,
    'border-transparent hover:scale-105 hover:shadow-sm'
  ),
  pill: (config: any) => cn(
    config.bg,
    config.text,
    config.border,
    'shadow-md'
  ),
  timeline: (config: any) => cn(''),
  'dot-only': (config: any) => cn('')
};

const pulseColors = {
  blue: 'bg-blue-500',
  teal: 'bg-blue-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  purple: 'bg-purple-500',
  cyan: 'bg-sky-500',
  zinc: 'bg-zinc-400',
  slate: 'bg-slate-500'
};

const statusPulseColor: Record<AppointmentStatus, keyof typeof pulseColors> = {
  CONFIRMED: 'blue',
  CHECKED_IN: 'amber',
  IN_CONSULTATION: 'purple',
  COMPLETED: 'emerald',
  CANCELLED: 'rose',
  NO_SHOW: 'zinc',
  RESCHEDULED: 'slate'
};

const liveStatuses: AppointmentStatus[] = ['CHECKED_IN', 'IN_CONSULTATION'];

export function EnhancedStatusBadge({
  status,
  variant = 'default',
  size = 'md',
  showPulse = true,
  animated = false,
  showIcon = true,
  className,
  onClick
}: EnhancedStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NO_SHOW;
  const pulseColor = statusPulseColor[status];
  const isLive = liveStatuses.includes(status);

  if (variant === 'dot-only') {
    return (
      <span
        className={cn(
          'relative inline-flex items-center justify-center',
          showPulse && isLive && 'animate-pulse-glow'
        )}
      >
        {showPulse && isLive && (
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', pulseColors[pulseColor])} />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', pulseColors[pulseColor])} />
      </span>
    );
  }

  if (variant === 'timeline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span
          className={cn(
            'relative flex h-2 w-2 rounded-full',
            pulseColors[pulseColor]
          )}
        >
          {showPulse && isLive && (
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', pulseColors[pulseColor])} />
          )}
        </span>
        <span className={cn('font-medium', config.text)}>
          {config.label}
        </span>
      </div>
    );
  }

  const Component = onClick ? 'button' : 'span';
  const interactiveStyles = onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2' : '';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={cn(
        'inline-flex items-center font-medium rounded-full border transition-all duration-300',
        sizeMap[size],
        variantStyles[variant](config),
        animated && isLive && 'animate-pulse-glow',
        'hover:shadow-md',
        interactiveStyles,
        className
      )}
      onClick={onClick}
    >
      {showPulse && (
        <span className="relative flex h-1.5 w-1.5">
          {showPulse && isLive && (
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', pulseColors[pulseColor])} />
          )}
          <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', pulseColors[pulseColor])} />
        </span>
      )}
      {showIcon && statusIcons[status]}
      <span className="truncate">{config.label}</span>
    </Component>
  );
}

// Specialized token badge for queue positions
interface TokenBadgeProps {
  tokenNumber?: number | null;
  queuePosition?: number | null;
  estimatedWaitTime?: number | null;
  status: AppointmentStatus;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'detailed';
  animated?: boolean;
}

export function TokenBadge({
  tokenNumber,
  queuePosition,
  estimatedWaitTime,
  status,
  size = 'md',
  variant = 'default',
  animated = false
}: TokenBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NO_SHOW;
  const isLive = ['CHECKED_IN', 'IN_CONSULTATION'].includes(status);
  const pulseColor = statusPulseColor[status];

  const sizeStyles = {
    sm: 'text-xs min-w-[50px] px-2 py-1',
    md: 'text-sm min-w-[60px] px-3 py-1.5',
    lg: 'text-base min-w-[70px] px-4 py-2'
  };

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl font-mono font-bold',
          sizeStyles[size],
          'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 text-amber-900 shadow-sm',
          animated && isLive && 'animate-pulse-glow shadow-glow-amber'
        )}
      >
        {tokenNumber && `#${tokenNumber}`}
        {queuePosition && tokenNumber && (
          <>
            <span className="w-px h-4 bg-amber-200" />
            <span className="text-slate-600 font-normal">Pos #{queuePosition}</span>
          </>
        )}
        {animated && isLive && (
          <div className="absolute -inset-0.5 rounded-xl border border-amber-400 animate-ping opacity-30" />
        )}
      </span>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center justify-center rounded-xl font-mono font-black border shadow-sm',
              sizeStyles[size],
              'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 text-amber-900',
              animated && isLive && 'animate-pulse-glow shadow-glow-amber'
            )}
          >
            {tokenNumber ? `#${tokenNumber}` : '—'}
          </span>
          {animated && isLive && (
            <span className="relative flex h-2 w-2">
              <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', pulseColors[pulseColor])} />
              <span className={cn('relative inline-flex rounded-full h-2 w-2', pulseColors[pulseColor])} />
            </span>
          )}
        </div>
        
        {queuePosition !== null && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium">Queue Position:</span>
            <span className="font-bold text-slate-900">#{queuePosition}</span>
          </div>
        )}
        
        {estimatedWaitTime !== null && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium">Est. Wait:</span>
            <span className="font-bold text-blue-700">{estimatedWaitTime}m</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl font-mono font-bold',
        sizeStyles[size],
        'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 text-amber-900 shadow-sm transition-all duration-300',
        animated && isLive && 'animate-pulse-glow shadow-glow-amber',
        'hover:shadow-md'
      )}
    >
      {tokenNumber ? `#${tokenNumber}` : '—'}
    </span>
  );
}

// Queue position indicator
interface QueuePositionProps {
  position: number;
  total?: number;
  maxVisible?: number;
  animated?: boolean;
}

export function QueuePosition({
  position,
  total,
  maxVisible = 5,
  animated = false
}: QueuePositionProps) {
  const visiblePositions = Array.from(
    { length: Math.min(total || position, maxVisible) },
    (_, i) => i + 1
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {visiblePositions.map((pos) => (
        <div
          key={pos}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono font-bold text-xs transition-all duration-300',
            pos === position
              ? 'bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-glow-blue'
              : pos < position
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-400'
          )}
          style={{
            animationDelay: animated ? `${pos * 50}ms` : '0'
          }}
        >
          {pos}
        </div>
      ))}
      {total && total > maxVisible && (
        <span className="text-xs text-slate-500 px-2">
          ... {total} total
        </span>
      )}
    </div>
  );
}
