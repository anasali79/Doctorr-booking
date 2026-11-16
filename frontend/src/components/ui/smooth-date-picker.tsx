'use client';

import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn, formatDate, getTodayIST } from '@/lib/utils';

export interface SmoothDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function SmoothDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  className,
  placeholder = 'Select date',
}: SmoothDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const todayIST = getTodayIST();

  // Active viewing month & year
  const initialYearMonth = useMemo(() => {
    const target = value || minDate || todayIST;
    const [y, m] = target.split('-').map(Number);
    return { year: y || new Date().getFullYear(), month: (m ? m - 1 : new Date().getMonth()) };
  }, [value, minDate, todayIST]);

  const [viewYear, setViewYear] = useState<number>(initialYearMonth.year);
  const [viewMonth, setViewMonth] = useState<number>(initialYearMonth.month); // 0-indexed

  // Format display text
  const displayText = useMemo(() => {
    if (!value) return placeholder;
    if (value === todayIST) return `Today (${formatDate(value)})`;

    // Check tomorrow
    const [ty, tm, td] = todayIST.split('-').map(Number);
    const tomorrowObj = new Date(ty, tm - 1, td + 1);
    const tomY = tomorrowObj.getFullYear();
    const tomM = String(tomorrowObj.getMonth() + 1).padStart(2, '0');
    const tomD = String(tomorrowObj.getDate()).padStart(2, '0');
    const tomorrowStr = `${tomY}-${tomM}-${tomD}`;

    if (value === tomorrowStr) return `Tomorrow (${formatDate(value)})`;

    return formatDate(value);
  }, [value, todayIST, placeholder]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Previous month padding
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: false,
        isDisabled: true,
        isToday: dStr === todayIST,
        isSelected: dStr === value,
      });
    }

    // Current month days
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      let isDisabled = false;
      if (minDate && dStr < minDate) isDisabled = true;
      if (maxDate && dStr > maxDate) isDisabled = true;

      days.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: true,
        isDisabled,
        isToday: dStr === todayIST,
        isSelected: dStr === value,
      });
    }

    // Next month padding to fill out 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNum: i,
        isCurrentMonth: false,
        isDisabled: true,
        isToday: dStr === todayIST,
        isSelected: dStr === value,
      });
    }

    return days;
  }, [viewYear, viewMonth, minDate, maxDate, todayIST, value]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  // Quick Preset Helper
  const handleQuickPreset = (offsetDays: number) => {
    const [y, m, d] = todayIST.split('-').map(Number);
    const target = new Date(y, m - 1, d + offsetDays);
    const yStr = target.getFullYear();
    const mStr = String(target.getMonth() + 1).padStart(2, '0');
    const dStr = String(target.getDate()).padStart(2, '0');
    const result = `${yStr}-${mStr}-${dStr}`;
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    selectDate(result);
  };

  const handleNextMonday = () => {
    const [y, m, d] = todayIST.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const day = target.getDay();
    const daysUntilNextMon = ((1 - day + 7) % 7) || 7;
    target.setDate(target.getDate() + daysUntilNextMon);
    const yStr = target.getFullYear();
    const mStr = String(target.getMonth() + 1).padStart(2, '0');
    const dStr = String(target.getDate()).padStart(2, '0');
    const result = `${yStr}-${mStr}-${dStr}`;
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    selectDate(result);
  };

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
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium text-xs text-slate-900 truncate">
              {displayText}
            </span>
          </div>

          <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform duration-200" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[310px] p-3.5 bg-white border border-slate-200 shadow-2xl rounded-2xl space-y-3"
      >
        {/* Quick presets strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => handleQuickPreset(0)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 transition-colors cursor-pointer shrink-0"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset(1)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 transition-colors cursor-pointer shrink-0"
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={handleNextMonday}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 transition-colors cursor-pointer shrink-0"
          >
            Next Mon
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset(7)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 transition-colors cursor-pointer shrink-0"
          >
            +7 Days
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between pt-1">
          <span className="font-bold text-xs text-slate-900 tracking-tight">
            {monthNames[viewMonth]} {viewYear}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
            <span
              key={d}
              className={cn(
                'text-[10px] font-bold tracking-wider',
                i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-500'
              )}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((cell, idx) => {
            return (
              <button
                key={idx}
                type="button"
                disabled={cell.isDisabled}
                onClick={() => selectDate(cell.dateStr)}
                className={cn(
                  'relative h-8 w-8 mx-auto rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer',
                  !cell.isCurrentMonth && 'text-slate-300 pointer-events-none',
                  cell.isCurrentMonth && !cell.isDisabled && !cell.isSelected && 'text-slate-700 hover:bg-blue-50 hover:text-blue-700',
                  cell.isDisabled && 'text-slate-300 cursor-not-allowed opacity-40 hover:bg-transparent',
                  cell.isToday && !cell.isSelected && 'border border-blue-400 text-blue-700 font-bold bg-blue-50/40',
                  cell.isSelected && 'bg-blue-600 text-white font-extrabold shadow-2xs hover:bg-blue-700'
                )}
              >
                <span>{cell.dayNum}</span>
                {cell.isToday && !cell.isSelected && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Selected date display */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">
            Selected: <strong className="text-slate-700">{value ? formatDate(value) : 'None'}</strong>
          </span>
          <Button
            type="button"
            size="xs"
            onClick={() => setIsOpen(false)}
            className="rounded-xl px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold h-6 text-[10px]"
          >
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

