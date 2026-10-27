# Enhanced Design System - Schedula Platform

## 🎨 Enhanced Design Tokens

### Primary Palette (Extended)
```css
--color-brand-50: #f0fdfa;
--color-brand-100: #ccfbf1;
--color-brand-200: #99f6e4;
--color-brand-300: #5eead4;
--color-brand-400: #2dd4bf;  /* --primary: #0d9488; */
--color-brand-500: #14b8a6;
--color-brand-600: #0d9488;  /* --primary: #0d9488; */
--color-brand-700: #0f766e;  /* --primary-hover: #0f766e; */
--color-brand-800: #115e59;
--color-brand-900: #134e4a;
--color-brand-950: #042f2e;

/* Enhanced neutrals for better contrast */
--color-slate-25: #f9fafb;
--color-slate-50: #f3f4f6;
--color-slate-75: #f8fafc;
--color-slate-100: #f1f5f9;
--color-slate-150: #e2e8f0;
--color-slate-200: #e2e8f0;
--color-slate-300: #cbd5e1;
--color-slate-400: #94a3b8;
--color-slate-500: #64748b;
--color-slate-600: #475569;
--color-slate-700: #334155;
--color-slate-800: #1e293b;
--color-slate-900: #0f172a;
--color-slate-950: #020617;

/* Enhanced semantic colors */
--color-success-50: #f0fdf4;
--color-success-400: #4ade80;
--color-success-500: #22c55e;
--color-success-600: #16a34a;
--color-success-700: #15803d;

--color-warning-50: #fffbeb;
--color-warning-400: #fbbf24;
--color-warning-500: #f59e0b;
--color-warning-600: #d97706;
--color-warning-700: #b45309;

--color-error-50: #fef2f2;
--color-error-400: #f87171;
--color-error-500: #ef4444;
--color-error-600: #dc2626;
--color-error-700: #b91c1c;

--color-info-50: #eff6ff;
--color-info-400: #60a5fa;
--color-info-500: #3b82f6;
--color-info-600: #2563eb;
--color-info-700: #1d4ed8;
```

### Shadow System (Enhanced)
```css
--shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -1px rgba(15, 23, 42, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04);
--shadow-2xl: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
--shadow-inner: inset 0 2px 4px 0 rgba(15, 23, 42, 0.06);
--shadow-neu-light: 5px 5px 15px #f1f5f9, -5px -5px 15px #ffffff;
--shadow-neu-dark: 5px 5px 15px #e2e8f0, -5px -5px 15px rgba(255, 255, 255, 0.8);
--shadow-glow-teal: 0 0 20px rgba(13, 148, 136, 0.3);
--shadow-glow-cyan: 0 0 20px rgba(6, 182, 212, 0.3);
--shadow-glow-rose: 0 0 20px rgba(244, 63, 94, 0.3);
```

### Animation Curves
```css
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-sine: cubic-bezier(0.45, 0, 0.55, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

## 🧩 Enhanced Component Library

### 1. Enhanced Card Components

#### Card Premium (Elevated)
```tsx
import { cn } from '@/lib/utils';

interface EnhancedCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  glowColor?: 'teal' | 'cyan' | 'rose' | 'none';
}

export function EnhancedCard({ 
  children, 
  className, 
  hoverEffect = false,
  glowColor = 'none'
}: EnhancedCardProps) {
  const glowMap = {
    teal: 'shadow-glow-teal',
    cyan: 'shadow-glow-cyan',
    rose: 'shadow-glow-rose',
    none: ''
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white transition-all duration-300',
        'shadow-card hover:shadow-card-hover',
        hoverEffect && 'hover:-translate-y-1 hover:border-teal-300/50',
        glowMap[glowColor],
        className
      )}
    >
      {/* Subtle gradient border effect */}
      <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-transparent via-teal-200/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      {children}
    </div>
  );
}
```

#### Glass Card (With blur effect)
```tsx
export function GlassCard({ 
  children, 
  className,
  opacity = 'medium'
}: {
  children: React.ReactNode;
  className?: string;
  opacity?: 'light' | 'medium' | 'dark';
}) {
  const opacityMap = {
    light: 'bg-white/70 backdrop-blur-sm border-slate-200/40',
    medium: 'bg-white/82 backdrop-blur-md border-slate-200/60',
    dark: 'bg-slate-900/70 backdrop-blur-lg border-slate-700/40'
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl border shadow-glass',
        opacityMap[opacity],
        className
      )}
    >
      {children}
    </div>
  );
}
```

### 2. Enhanced Buttons

#### Ripple Button (Material Design inspired)
```tsx
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface RippleButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function RippleButton({
  children,
  onClick,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = { x, y, id: Date.now() };
    setRipples(prev => [...prev, newRipple]);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);

    onClick?.();
  };

  const variantStyles = {
    primary: 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-700 hover:to-cyan-700 shadow-glow-teal',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm',
    outline: 'bg-transparent border-2 border-teal-600 text-teal-600 hover:bg-teal-50',
    danger: 'bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800 shadow-glow-rose'
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <button
      classn={cn(
        'relative overflow-hidden rounded-xl font-semibold transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2',
        'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      {/* Ripple effects */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 animate-ripple"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20
          }}
        />
      ))}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
```

#### Gradient Button (Animated gradients)
```tsx
export function GradientButton({
  children,
  className,
  gradient = 'teal-cyan',
  animated = true
}: {
  children: React.ReactNode;
  className?: string;
  gradient?: 'teal-cyan' | 'cyan-teal' | 'emerald-teal' | 'rose-cyan';
  animated?: boolean;
}) {
  const gradientMap = {
    'teal-cyan': 'bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-600 bg-[length:200%_100%]',
    'cyan-teal': 'bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-600 bg-[length:200%_100%]',
    'emerald-teal': 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 bg-[length:200%_100%]',
    'rose-cyan': 'bg-gradient-to-r from-rose-600 via-cyan-600 to-rose-600 bg-[length:200%_100%]'
  };

  return (
    <button
      className={cn(
        'relative rounded-xl px-6 py-3 font-semibold text-white transition-all duration-300',
        'hover:shadow-lg hover:scale-[1.02] active:scale-95',
        gradientMap[gradient],
        animated && 'hover:bg-position-[100%_0]',
        className
      )}
      style={{
        backgroundSize: '200% 100%',
        transition: 'background-position 0.5s ease'
      }}
    >
      {children}
    </button>
  );
}
```

### 3. Enhanced Status Badge

#### Live Pulse Badge
```tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { AppointmentStatus } from '@/types';
import { STATUS_CONFIG } from '@/lib/constants';

interface EnhancedStatusBadgeProps {
  status: AppointmentStatus;
  variant?: 'default' | 'outline' | 'subtle' | 'timeline';
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  animated?: boolean;
}

export function EnhancedStatusBadge({
  status,
  variant = 'default',
  size = 'md',
  showPulse = true,
  animated = false
}: EnhancedStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NO_SHOW;
  
  const sizeMap = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2'
  };

  const pulseClasses = status === 'CHECKED_IN' || status === 'IN_CONSULTATION' 
    ? 'animate-pulse-glow' 
    : '';

  if (variant === 'timeline') {
    return (
      <div className="flex items-center gap-2">
        <span className={cn('relative flex h-2 w-2', config.dot)}>
          {showPulse && (
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', config.dot)} />
          )}
        </span>
        <span className={cn('font-medium', config.text)}>{config.label}</span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border transition-all duration-300',
        sizeMap[size],
        {
          'default': cn(config.bg, config.text, config.border, 'shadow-xs'),
          'outline': cn('bg-white border-2', config.text, config.border, 'shadow-sm hover:shadow-md'),
          'subtle': cn(config.bg, config.text, 'border-transparent hover:scale-105'),
        }[variant],
        animated && pulseClasses,
        'hover:shadow-md'
      )}
    >
      {showPulse && (
        <span className="relative flex h-1.5 w-1.5">
          {status === 'CHECKED_IN' || status === 'IN_CONSULTATION' ? (
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', config.dot)} />
          ) : null}
          <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', config.dot)} />
        </span>
      )}
      {config.label}
    </span>
  );
}
```

### 4. New Component: Token Display

#### Live Token Badge
```tsx
interface TokenDisplayProps {
  tokenNumber?: number | null;
  status: AppointmentStatus;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function TokenDisplay({
  tokenNumber,
  status,
  size = 'md',
  animated = false
}: TokenDisplayProps) {
  const sizeMap = {
    sm: 'text-xs px-2 py-1 min-w-[60px]',
    md: 'text-sm px-3 py-1.5 min-w-[70px]',
    lg: 'text-base px-4 py-2 min-w-[80px]'
  };

  const isLive = status === 'CHECKED_IN' || status === 'IN_CONSULTATION';

  return (
    <div className="relative inline-block">
      <span
        className={cn(
          'relative font-mono font-black rounded-full border shadow-sm transition-all duration-300',
          sizeMap[size],
          tokenNumber
            ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-400',
          animated && tokenNumber && 'animate-pulse-glow',
          isLive && tokenNumber && 'shadow-glow-amber'
        )}
      >
        {tokenNumber ? `#${tokenNumber}` : '—'}
      </span>
      {animated && tokenNumber && isLive && (
        <div className="absolute -inset-0.5 rounded-full border border-amber-400 animate-ping opacity-30" />
      )}
    </div>
  );
}
```

### 5. Enhanced Input Components

#### Animated Input
```tsx
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'minimal';
}

export function AnimatedInput({
  label,
  error,
  icon,
  variant = 'default',
  className,
  ...props
}: AnimatedInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = props.value || props.defaultValue;

  const variantStyles = {
    default: cn(
      'border-slate-200 bg-white',
      'focus:border-teal-500 focus:ring-teal-500/20',
      'hover:border-slate-300'
    ),
    filled: cn(
      'border-transparent bg-slate-50',
      'focus:bg-white focus:border-teal-500'
    ),
    minimal: cn(
      'border-0 border-b-2 border-slate-200 rounded-none',
      'focus:border-teal-500 focus:ring-0'
    )
  };

  return (
    <div className="relative">
      {label && (
        <label
          className={cn(
            'block text-sm font-medium mb-1.5 transition-colors',
            isFocused ? 'text-teal-700' : 'text-slate-600'
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 transition-colors',
              isFocused ? 'text-teal-600' : 'text-slate-400'
            )}
          >
            {icon}
          </div>
        )}
        <input
          className={cn(
            'w-full rounded-xl px-4 py-2.5 text-sm',
            'transition-all duration-200',
            'placeholder:text-slate-400',
            'disabled:bg-slate-50 disabled:text-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-teal-500/20',
            icon ? 'pl-10' : 'pl-4',
            variantStyles[variant],
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
            className
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {hasValue && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
```

### 6. Enhanced Navigation Components

#### Glass Navigation
```tsx
import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface GlassNavItemProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function GlassNavItem({ href, children, active, onClick }: GlassNavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative px-4 py-2 text-sm font-medium rounded-xl',
        'transition-all duration-200',
        'hover:bg-white/60',
        active
          ? 'text-teal-800 bg-teal-50/80 shadow-sm'
          : 'text-slate-600 hover:text-slate-900'
      )}
    >
      {active && (
        <span className="absolute inset-0 rounded-xl bg-teal-50/50 border border-teal-200/40 shadow-inner" />
      )}
      <span className="relative z-10">{children}</span>
    </Link>
  );
}
```

## 📄 Enhanced Page Templates

### Enhanced Doctor Dashboard Template
```tsx
export function EnhancedDoctorDashboardTemplate({
  children,
  stats,
  actionItems
}: {
  children: React.ReactNode;
  stats: DashboardStat[];
  actionItems: DashboardAction[];
}) {
  return (
    <div className="page-container space-y-8 py-8">
      {/* Enhanced Header Banner */}
      <GlassCard opacity="medium" className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-1 w-6 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full" />
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                <Activity className="h-3 w-3" />
                Real-Time Clinic
              </span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              {userProfile?.fullName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {userProfile?.specialization} • {userProfile?.experience} years experience
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {actionItems.map((action) => (
              <button
                key={action.href}
                onClick={() => action.onClick?.()}
                className={cn(
                  'relative px-5 py-3 rounded-xl font-semibold text-sm transition-all',
                  'hover:scale-[1.02] active:scale-95',
                  action.variant === 'primary'
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-glow-teal'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <GlassCard
            key={stat.label}
            opacity="light"
            className="p-4 hover:shadow-lg transition-shadow"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {stat.label}
              </span>
              <div className={cn('p-2 rounded-lg', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {typeof stat.value === 'number' && stat.value > 999
                  ? `${(stat.value / 1000).toFixed(1)}k`
                  : stat.value}
              </span>
              {stat.change && (
                <span className={cn('text-xs font-medium', stat.change > 0 ? 'text-emerald-600' : 'text-rose-600')}>%
                  {stat.change > 0 ? '+' : ''}{stat.change}%</span>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Main Content */}
      <div className="mt-8">
        {children}
      </div>
    </div>
  );
}
```

## 🎯 Utility Functions

### Animation Variants
```tsx
export const animationVariants = {
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};
```

### Layout Utilities
```tsx
export const layoutClasses = {
  // Grid layouts
  statsGrid: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6',
  doctorCards: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5',
  appointmentGrid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  
  // Flex layouts
  center: 'flex items-center justify-center',
  between: 'flex items-center justify-between',
  start: 'flex items-start',
  
  // Spacing
  section: 'py-8 sm:py-10 space-y-8',
  card: 'p-6 sm:p-8 rounded-3xl',
  
  // Text
  heading1: 'text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900',
  heading2: 'text-xl sm:text-2xl font-bold text-slate-900',
  body: 'text-sm sm:text-base text-slate-600 leading-relaxed'
};
```

### Color Utilities
```tsx
export const colorUtilities = {
  // Gradient text
  gradientText: 'bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent',
  
  // Status colors
  status: {
    confirmed: 'text-teal-700 bg-teal-50 border-teal-200',
    checkedIn: 'text-amber-700 bg-amber-50 border-amber-200',
    inConsultation: 'text-purple-700 bg-purple-50 border-purple-200',
    completed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    cancelled: 'text-rose-700 bg-rose-50 border-rose-200',
    noShow: 'text-zinc-700 bg-zinc-100 border-zinc-200'
  },
  
  // Background variations
  backgrounds: {
    primary: 'bg-gradient-to-br from-teal-50 via-white to-cyan-50',
    dark: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    glass: 'bg-white/80 backdrop-blur-md'
  }
};
```

## 🚀 Implementation Checklist

### Design Tokens
- [ ] Update `globals.css` with enhanced tokens
- [ ] Add dark mode support for new tokens
- [ ] Update component themes to use new tokens

### Component Library
- [ ] Implement `EnhancedCard` component
- [ ] Implement `RippleButton` component  
- [ ] Implement `EnhancedStatusBadge` component
- [ ] Implement `TokenDisplay` component
- [ ] Implement `AnimatedInput` component
- [ ] Implement `EnhancedNavItem` component

### Enhanced Pages
- [ ] Update Doctor Dashboard with enhanced template
- [ ] Update Patient Dashboard with enhanced UI
- [ ] Enhance Doctors Directory page
- [ ] Update Appointment Tables with enhanced status badges

### Animations & Effects
- [ ] Add ripple effect to buttons
- [ ] Implement hover animations for cards
- [ ] Add live pulse effects to status badges
- [ ] Create staggered animations for lists
- [ ] Implement smooth scrolling

### Documentation
- [ ] Create component documentation
- [ ] Add design guidelines
- [ ] Document animation behavior
- [ ] Provide usage examples

This enhanced design system provides a comprehensive upgrade to the existing Schedula platform with modern animations, better visual hierarchy, improved accessibility, and consistent interaction patterns. The new components maintain backward compatibility while offering enhanced user experiences.