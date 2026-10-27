'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EnhancedCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  glowColor?: 'teal' | 'cyan' | 'rose' | 'emerald' | 'blue' | 'sky' | 'none';
  variant?: 'default' | 'glass' | 'premium' | 'minimal';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function EnhancedCard({
  children,
  className,
  hoverEffect = true,
  glowColor = 'none',
  variant = 'default',
  padding = 'md',
  animated = false
}: EnhancedCardProps) {
  const paddingMap = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-6 sm:p-8'
  };

  const glowMap = {
    blue: 'shadow-glow-blue',
    sky: 'shadow-glow-sky',
    teal: 'shadow-glow-blue',
    cyan: 'shadow-glow-sky',
    rose: 'shadow-glow-rose',
    emerald: 'shadow-glow-emerald',
    none: ''
  };

  const variantMap = {
    default: 'bg-white border-slate-200/60 shadow-card',
    glass: 'bg-white/80 backdrop-blur-md border-slate-200/60 shadow-glass',
    premium: 'bg-gradient-to-br from-white via-white to-slate-50 border-slate-200/60 shadow-elevated',
    minimal: 'bg-transparent border-transparent shadow-none'
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-all duration-300',
        paddingMap[padding],
        variantMap[variant],
        hoverEffect && 'hover:-translate-y-1 hover:shadow-card-hover',
        glowMap[glowColor],
        animated && 'animate-fade-up',
        className
      )}
    >
      {variant === 'premium' && (
        <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-transparent via-blue-200/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}
      {children}
    </div>
  );
}

export function GlassCard({
  children,
  className,
  opacity = 'medium',
  padding = 'md',
  hoverEffect = false
}: {
  children: React.ReactNode;
  className?: string;
  opacity?: 'light' | 'medium' | 'dark';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverEffect?: boolean;
}) {
  const opacityMap = {
    light: 'bg-white/70 backdrop-blur-sm border-slate-200/40',
    medium: 'bg-white/82 backdrop-blur-md border-slate-200/60',
    dark: 'bg-slate-900/70 backdrop-blur-lg border-slate-700/40'
  };

  const paddingMap = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-6 sm:p-8'
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl border shadow-glass transition-all duration-300',
        opacityMap[opacity],
        paddingMap[padding],
        hoverEffect && 'hover:shadow-lg hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </div>
  );
}