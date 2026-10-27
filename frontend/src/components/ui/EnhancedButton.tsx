'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  animatedGradient?: boolean;
  gradientVariant?: 'blue-cyan' | 'sky-teal' | 'emerald-teal' | 'rose-cyan' | 'indigo-purple' | 'blue-sky';
  rippleColor?: 'white' | 'teal' | 'cyan' | 'rose' | 'blue';
}

const variantStyles = {
  primary: 'bg-gradient-to-r from-blue-600 to-sky-600 text-white hover:from-blue-700 hover:to-sky-700 shadow-glow-blue',
  secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm hover:shadow-md',
  outline: 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700',
  danger: 'bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800 shadow-glow-rose',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  success: 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:from-emerald-700 hover:to-blue-700 shadow-glow-emerald'
};

const sizeStyles = {
  xs: 'px-3 py-1.5 text-xs gap-1',
  sm: 'px-4 py-2 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
  xl: 'px-8 py-4 text-lg gap-2.5'
};

const gradientStyles = {
  'blue-cyan': 'from-blue-600 via-sky-600 to-blue-600',
  'sky-teal': 'from-sky-600 via-blue-600 to-sky-600',
  'blue-sky': 'from-blue-600 via-sky-600 to-blue-600',
  'emerald-teal': 'from-emerald-600 via-blue-600 to-emerald-600',
  'rose-cyan': 'from-rose-600 via-sky-600 to-rose-600',
  'indigo-purple': 'from-indigo-600 via-purple-600 to-indigo-600'
};

const rippleColors = {
  white: 'bg-white/30',
  teal: 'bg-blue-400/40',
  cyan: 'bg-sky-400/40',
  blue: 'bg-blue-400/40',
  rose: 'bg-rose-400/40'
};

export function RippleButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  animatedGradient = false,
  gradientVariant = 'blue-cyan',
  rippleColor = 'white',
  disabled,
  onClick,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = { x, y, id: Date.now() };
    setRipples(prev => [...prev, newRipple]);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);

    onClick?.(e);
  };

  const isGradient = ['primary', 'danger', 'success'].includes(variant);
  const gradient = animatedGradient && isGradient;

  return (
    <button
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-xl font-semibold',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2',
        'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        gradient && 'bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500',
        gradient && gradientStyles[gradientVariant],
        className
      )}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {/* Ripple effects */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className={cn(
            'absolute rounded-full animate-ripple pointer-events-none',
            rippleColors[rippleColor]
          )}
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20
          }}
        />
      ))}

      {/* Gradient animated overlay for animated gradient buttons */}
      {gradient && (
        <div
          className="absolute inset-0 bg-[length:200%_100%] opacity-0 group-hover:opacity-20 transition-opacity duration-500"
          style={{
            background: `linear-gradient(90deg, ${gradientStyles[gradientVariant].replace('from-', '').replace('via-', '').replace('to-', '').split(' ').join(', ')})`,
            backgroundSize: '200% 100%'
          }}
        />
      )}

      <span className="relative z-10 flex items-center justify-center gap-1.5">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </span>
    </button>
  );
}

// Export also as default for backwards compatibility
export default RippleButton;
