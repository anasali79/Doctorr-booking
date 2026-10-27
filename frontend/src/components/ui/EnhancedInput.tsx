'use client';

import React, { useState, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface EnhancedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'minimal' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showValidation?: boolean;
  loading?: boolean;
}

export const EnhancedInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      trailingIcon,
      variant = 'default',
      size = 'md',
      animated = true,
      showValidation = true,
      loading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);
    
    React.useEffect(() => {
      setHasValue(!!props.value || !!props.defaultValue);
    }, [props.value, props.defaultValue]);

    const variantStyles = {
      default: cn(
        'border-slate-200 bg-white',
        'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
        'hover:border-slate-300'
      ),
      filled: cn(
        'border-transparent bg-slate-50',
        'focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
      ),
      minimal: cn(
        'border-0 border-b-2 border-slate-200 rounded-none',
        'focus:border-blue-500 focus:ring-0 focus:bg-transparent'
      ),
      underline: cn(
        'border-0 border-b border-slate-300 rounded-none bg-transparent px-0',
        'focus:border-blue-500 focus:ring-0'
      )
    };

    const sizeStyles = {
      sm: cn('px-3 py-1.5 text-sm', icon ? 'pl-9' : 'pl-3'),
      md: cn('px-4 py-2.5 text-sm', icon ? 'pl-10' : 'pl-4'),
      lg: cn('px-5 py-3 text-base', icon ? 'pl-11' : 'pl-5')
    };

    const labelStyles = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base'
    };

    return (
      <div className={cn('relative', className)}>
        {label && (
          <label
            className={cn(
              'block font-medium mb-1.5 transition-all duration-200',
              labelStyles[size],
              isFocused && !error ? 'text-blue-700' : 'text-slate-600',
              error && 'text-rose-600',
              disabled && 'text-slate-400 cursor-not-allowed'
            )}
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none',
                isFocused ? 'text-blue-600 scale-110' : 'text-slate-400',
                loading && 'animate-pulse'
              )}
            >
              {icon}
            </div>
          )}

          <input
            ref={ref}
            className={cn(
              'w-full rounded-xl',
              'transition-all duration-200 ease-out',
              'placeholder:text-slate-400 placeholder:transition-colors',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              'focus:outline-none',
              'selection:bg-blue-200',
              variantStyles[variant],
              sizeStyles[size],
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
              showValidation && hasValue && !error && !loading && 'border-emerald-400',
              trailingIcon && 'pr-10',
              className
            )}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            onChange={(e) => {
              setHasValue(!!e.target.value);
              props.onChange?.(e);
            }}
            disabled={disabled || loading}
            {...props}
          />

          {/* Floating validation indicator */}
          {animated && showValidation && hasValue && !error && !loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}

          {/* Trailing icon */}
          {trailingIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors">
              {trailingIcon}
            </div>
          )}

          {/* Animated border highlight */}
          {animated && isFocused && !error && (
            <div className="absolute inset-0 rounded-xl border-2 border-blue-500/50 pointer-events-none animate-shimmer" />
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1 animate-fade-up">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </p>
        )}

        {hint && !error && (
          <p className="mt-1.5 text-xs text-slate-400 animate-fade-up">{hint}</p>
        )}
      </div>
    );
  }
);

EnhancedInput.displayName = 'EnhancedInput';

// Enhanced Textarea
interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: 'default' | 'filled' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showValidation?: boolean;
  autoResize?: boolean;
  characterLimit?: number;
}

export const EnhancedTextarea = forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  (
    {
      label,
      error,
      hint,
      variant = 'default',
      size = 'md',
      animated = true,
      showValidation = true,
      autoResize = false,
      characterLimit,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
      if (autoResize && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [props.value, autoResize]);

    const variantStyles = {
      default: cn('border-slate-200 bg-white', 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'),
      filled: cn('border-transparent bg-slate-50', 'focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'),
      minimal: cn('border-0 border-b-2 border-slate-200 rounded-none', 'focus:border-blue-500 focus:ring-0')
    };

    const sizeStyles = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-sm',
      lg: 'px-5 py-4 text-base'
    };

    return (
      <div className={className}>
        {label && (
          <label className={cn('block text-sm font-medium mb-1.5 transition-colors', isFocused && !error ? 'text-blue-700' : 'text-slate-600', error && 'text-rose-600', disabled && 'text-slate-400')}>
            {label}
          </label>
        )}
        
        <div className="relative">
          <textarea
            ref={(el) => {
              textareaRef.current = el;
              if (typeof ref === 'function') ref(el);
              else if (ref) ref.current = el;
            }}
            className={cn(
              'w-full rounded-xl resize-none',
              'transition-all duration-200',
              'placeholder:text-slate-400',
              'disabled:bg-slate-50 disabled:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
              'selection:bg-blue-200',
              variantStyles[variant],
              sizeStyles[size],
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
              showValidation && hasValue && !error && 'border-emerald-400',
              animated && isFocused && !error && 'animate-shimmer'
            )}
            onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
            onChange={(e) => { setHasValue(!!e.target.value); props.onChange?.(e); }}
            disabled={disabled}
            {...props}
          />
          
          {characterLimit && (
            <div className="absolute bottom-2 right-2 text-xs text-slate-400">
              {typeof props.value === 'string' ? props.value.length : 0} / {characterLimit}
            </div>
          )}
        </div>

        {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
      </div>
    );
  }
);

EnhancedTextarea.displayName = 'EnhancedTextarea';

// Enhanced Select
interface EnhancedSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  variant?: 'default' | 'filled' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export const EnhancedSelect = forwardRef<HTMLSelectElement, EnhancedSelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder,
      variant = 'default',
      size = 'md',
      animated = true,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(false);

    const variantStyles = {
      default: cn('border-slate-200 bg-white', 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'),
      filled: cn('border-transparent bg-slate-50', 'focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'),
      minimal: cn('border-0 border-b-2 border-slate-200 rounded-none', 'focus:border-blue-500 focus:ring-0')
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-5 py-3 text-base'
    };

    return (
      <div className={className}>
        {label && (
          <label className={cn('block text-sm font-medium mb-1.5 transition-colors', isFocused && !error ? 'text-blue-700' : 'text-slate-600', error && 'text-rose-600')}>
            {label}
          </label>
        )}
        
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full rounded-xl appearance-none',
              'transition-all duration-200',
              'disabled:bg-slate-50 disabled:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
              'selection:bg-blue-200',
              variantStyles[variant],
              sizeStyles[size],
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20',
              hasValue && !error && 'border-emerald-400',
              animated && isFocused && !error && 'animate-shimmer'
            )}
            onFocus={(e) => { setIsFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setIsFocused(false); props.onBlur?.(e); }}
            onChange={(e) => { setHasValue(!!e.target.value); props.onChange?.(e); }}
            disabled={disabled}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          
          {/* Custom dropdown arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 transition-transform">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
      </div>
    );
  }
);

EnhancedSelect.displayName = 'EnhancedSelect';