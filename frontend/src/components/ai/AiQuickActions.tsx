'use client';

import React from 'react';
import { Calendar, Clock, FileText, CreditCard, RotateCcw } from 'lucide-react';

interface AiQuickActionsProps {
  role: 'PATIENT' | 'DOCTOR';
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function AiQuickActions({ role, onSelect, disabled }: AiQuickActionsProps) {
  const patientPrompts = [
    {
      icon: Calendar,
      label: 'Meri next appointment kab hai?',
      prompt: 'Meri next appointment kab hai?',
    },
    {
      icon: Clock,
      label: 'Doctor ke available slots',
      prompt: 'Kal doctor ke paas koi slot available hai?',
    },
    {
      icon: RotateCcw,
      label: 'Reschedule appointment',
      prompt: 'Mujhe appointment reschedule karni hai.',
    },
    {
      icon: FileText,
      label: 'Prescription status',
      prompt: 'Meri prescription dikhao.',
    },
    {
      icon: CreditCard,
      label: 'Payment check',
      prompt: 'Mera payment successful hua ya nahi?',
    },
  ];

  const doctorPrompts = [
    {
      icon: Calendar,
      label: 'Aaj ke kitne appointments hain?',
      prompt: 'Aaj mere kitne appointments hain?',
    },
    {
      icon: Clock,
      label: 'Tomorrow schedule',
      prompt: 'Show my appointments for tomorrow.',
    },
    {
      icon: RotateCcw,
      label: 'Cancelled appointments',
      prompt: 'Mujhe aaj ke cancelled appointments dikhao.',
    },
    {
      icon: Clock,
      label: 'Next appointment time',
      prompt: 'Mere next appointment ka time kya hai?',
    },
  ];

  const items = role === 'DOCTOR' ? doctorPrompts : patientPrompts;

  return (
    <div className="flex flex-wrap gap-1.5 py-2">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item.prompt)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1.5 text-[11px] font-semibold text-blue-800 shadow-2xs hover:bg-blue-600 hover:text-white hover:border-blue-600 active:scale-95 disabled:opacity-40 transition-all cursor-pointer dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-600 dark:hover:text-white dark:hover:border-blue-500"
          >
            <Icon className="h-3 w-3 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
            <span className="group-hover:text-white transition-colors">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

