'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Radio } from 'lucide-react';

interface LiveIndicatorProps {
  isConnected: boolean;
  className?: string;
}

export function LiveIndicator({ isConnected, className }: LiveIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all',
        isConnected
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
          : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
        className,
      )}
      title={isConnected ? 'Real-time WebSocket connected' : 'Connecting to real-time service...'}
    >
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            isConnected ? 'bg-emerald-500' : 'bg-zinc-400',
          )}
        />
      </span>
      <span>{isConnected ? 'Live' : 'Connecting'}</span>
    </div>
  );
}
