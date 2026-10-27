import React from 'react';
import { AppointmentStatus } from '@/types';
import { STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: AppointmentStatus;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  };

  const isLivePulse = status === 'CHECKED_IN' || status === 'IN_CONSULTATION';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition-colors',
        config.bg,
        config.text,
        config.border,
        className,
      )}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {isLivePulse && (
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                config.dot,
              )}
            />
          )}
          <span
            className={cn('relative inline-flex rounded-full h-2 w-2', config.dot)}
          />
        </span>
      )}
      {config.label}
    </span>
  );
}
