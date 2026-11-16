'use client';

import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Clock, Sun, Sunset, Moon, ChevronDown, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SmoothTimePickerProps {
  value: string; // e.g. "09:00" or "17:30" (24h)
  onChange: (time24: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export function SmoothTimePicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = 'Select time',
}: SmoothTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse 24h value "HH:MM"
  const { hour24, minute, hour12, period } = useMemo(() => {
    if (!value || !value.includes(':')) {
      return { hour24: 9, minute: 0, hour12: 9, period: 'AM' as 'AM' | 'PM' };
    }
    const [hStr, mStr] = value.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { hour24: h, minute: m, hour12: h12, period: p };
  }, [value]);

  const updateTime = (newHour12: number, newMin: number, newPeriod: 'AM' | 'PM') => {
    let h24 = newHour12 % 12;
    if (newPeriod === 'PM') {
      h24 += 12;
    }
    const hStr = String(h24).padStart(2, '0');
    const mStr = String(newMin).padStart(2, '0');
    onChange(`${hStr}:${mStr}`);
  };

  const handleAdjustMinutes = (delta: number) => {
    const totalMinutes = hour24 * 60 + minute + delta;
    const bounded = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
    const h = Math.floor(bounded / 60);
    const m = bounded % 60;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  // Formatted display
  const displayString = useMemo(() => {
    if (!value) return placeholder;
    const padM = String(minute).padStart(2, '0');
    return `${hour12}:${padM} ${period}`;
  }, [value, hour12, minute, period, placeholder]);

  // Determine period icon
  const PeriodIcon = useMemo(() => {
    if (hour24 >= 6 && hour24 < 12) return Sun;
    if (hour24 >= 12 && hour24 < 18) return Sunset;
    return Moon;
  }, [hour24]);

  const presetTimes = [
    { label: '08:00 AM', value: '08:00' },
    { label: '09:00 AM', value: '09:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '11:00 AM', value: '11:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '01:00 PM', value: '13:00' },
    { label: '02:00 PM', value: '14:00' },
    { label: '04:00 PM', value: '16:00' },
    { label: '05:00 PM', value: '17:00' },
    { label: '06:00 PM', value: '18:00' },
    { label: '07:00 PM', value: '19:00' },
    { label: '08:00 PM', value: '20:00' },
  ];

  const commonMinutes = [0, 15, 30, 45];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'group relative flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 shadow-2xs transition-all hover:border-blue-400 hover:bg-slate-50/70 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
            isOpen && 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <PeriodIcon className="h-3.5 w-3.5" />
            </div>
            <span className="font-mono text-xs font-bold text-slate-900 tracking-tight">
              {displayString}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-slate-400 group-hover:text-slate-600">
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {period}
            </span>
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[320px] p-4 bg-white border border-slate-200 shadow-2xl rounded-2xl space-y-3.5"
      >
        {/* Header Display & Fine Adjusters */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 font-bold">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Selected Hour
              </span>
              <span className="font-mono text-sm font-extrabold text-slate-900">
                {displayString}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleAdjustMinutes(-15)}
              className="h-6 px-1.5 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-white hover:shadow-2xs transition-all flex items-center gap-0.5 cursor-pointer"
              title="-15 minutes"
            >
              <Minus className="h-3 w-3" /> 15m
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => handleAdjustMinutes(15)}
              className="h-6 px-1.5 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-white hover:shadow-2xs transition-all flex items-center gap-0.5 cursor-pointer"
              title="+15 minutes"
            >
              <Plus className="h-3 w-3" /> 15m
            </button>
          </div>
        </div>

        {/* Time Interactive Selector: Hours / Minutes / AM-PM */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>Hour</span>
            {/* AM / PM Toggle */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/60">
              <button
                type="button"
                onClick={() => updateTime(hour12, minute, 'AM')}
                className={cn(
                  'px-2.5 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer',
                  period === 'AM'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => updateTime(hour12, minute, 'PM')}
                className={cn(
                  'px-2.5 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer',
                  period === 'PM'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* 12-Hour Grid */}
          <div className="grid grid-cols-6 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
              const isSelected = hour12 === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => updateTime(h, minute, period)}
                  className={cn(
                    'h-8 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center cursor-pointer border',
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                      : 'border-slate-100 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                  )}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        {/* Minutes Grid */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-600 block">Minute</span>
          <div className="grid grid-cols-4 gap-1.5">
            {commonMinutes.map((m) => {
              const isSelected = minute === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateTime(hour12, m, period)}
                  className={cn(
                    'h-7 rounded-xl font-mono text-xs font-semibold transition-all flex items-center justify-center cursor-pointer border',
                    isSelected
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-600'
                      : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  )}
                >
                  :{String(m).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Shift Presets */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Clinic Shift Presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presetTimes.map((preset) => {
              const isCurrent = value === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    onChange(preset.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border',
                    isCurrent
                      ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Done button */}
        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">24h: {value || '—'}</span>
          <Button
            type="button"
            size="xs"
            onClick={() => setIsOpen(false)}
            className="rounded-xl px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold h-7"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

